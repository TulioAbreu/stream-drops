import { useEffect, useState, useCallback, useRef } from "react";
import tmi from "tmi.js";
import type { ChatMessage, ChatParticipant } from "../../types";
import { convertTmiMessage, convertMessageToParticipant } from "./utils";
import { canCollectChatParticipant } from "./guards";
import type { makeTwitchApiClient } from "@/service/twitch";

// Configurable constant for batch processing max wait time
const BATCH_MAX_WAIT_MS = 1500; // 2 seconds
const BATCH_MAX_SIZE = 100; // Twitch API limit
const EMPTY_EXCLUDED_USER_IDS: ReadonlySet<string> = new Set();

export interface ChatListenerClient {
    connect: () => Promise<unknown>;
    disconnect: () => Promise<unknown>;
    on: (event: string, listener: (...args: unknown[]) => void) => void;
}

export interface ChatListenerTestOverrides {
    createClient?: (channel: string) => ChatListenerClient;
    batchMaxWaitMs?: number;
}

let chatListenerTestOverrides: ChatListenerTestOverrides | null = null;

/** Só para testes: evita IRC real e encurta o lote. Produção não chama. */
export function setChatListenerTestOverrides(
    overrides: ChatListenerTestOverrides | null,
): void {
    chatListenerTestOverrides = overrides;
}

function createTwitchChatClient(channel: string): ChatListenerClient {
    const client = new tmi.Client({
        options: { debug: false },
        connection: {
            reconnect: true,
            secure: true,
        },
        channels: [channel],
    });
    return client as unknown as ChatListenerClient;
}

interface UseChatListenerOptions {
    channel: string;
    keyword: string;
    minimumSuscriptionTimeInMonths?: number;
    subscribersOnly?: boolean;
    twitchApiClient?: ReturnType<typeof makeTwitchApiClient>;
    broadcasterId?: string;
    /** Lido por ref: mudar a exclusão não recreia o lote nem zera a coleta. */
    excludedUserIds?: ReadonlySet<string>;
}

interface UseChatListenerReturn {
    participants: ChatParticipant[];
    allParticipants: ChatParticipant[];
    messages: ChatMessage[];
    isConnected: boolean;
    connectionStatus: "connecting" | "connected" | "disconnected" | "error";
    error: string | null;
    reconnect: () => void;
    clearParticipants: () => void;
    filterParticipants: (nameFilter: string) => void;
    nameFilter: string;
}

export function useChatListener({
    channel,
    keyword,
    minimumSuscriptionTimeInMonths = 0,
    subscribersOnly = false,
    twitchApiClient,
    broadcasterId,
    excludedUserIds = EMPTY_EXCLUDED_USER_IDS,
}: UseChatListenerOptions): UseChatListenerReturn {
    const [allParticipants, setAllParticipants] = useState<ChatParticipant[]>([]);
    const [participants, setParticipants] = useState<ChatParticipant[]>([]);
    const [nameFilter, setNameFilter] = useState<string>("");
    const [messages, setMessages] = useState<ChatMessage[]>([]);
    const [isConnected, setIsConnected] = useState(false);
    const [connectionStatus, setConnectionStatus] = useState<"connecting" | "connected" | "disconnected" | "error">("disconnected");
    const [error, setError] = useState<string | null>(null);

    const clientRef = useRef<ChatListenerClient | null>(null);
    const seenUserIdsRef = useRef<Set<string>>(new Set());
    const excludedUserIdsRef = useRef(excludedUserIds);
    const broadcasterIdRef = useRef(broadcasterId);
    const channelRef = useRef(channel);
    excludedUserIdsRef.current = excludedUserIds;
    broadcasterIdRef.current = broadcasterId;
    channelRef.current = channel;

    const collectionContext = useCallback(() => ({
        excludedUserIds: excludedUserIdsRef.current,
        broadcasterId: broadcasterIdRef.current,
        channel: channelRef.current,
    }), []);

    // Queue system refs
    const pendingUserIdsRef = useRef<Set<string>>(new Set());
    const pendingMessagesRef = useRef<Map<string, ChatMessage>>(new Map());
    const batchTimerRef = useRef<NodeJS.Timeout | null>(null);
    const isFetchingRef = useRef(false);

    // Process batch of pending user IDs to fetch their subscription tiers
    const processBatch = useCallback(async () => {
        if (isFetchingRef.current || pendingUserIdsRef.current.size === 0) {
            return;
        }

        if (!twitchApiClient || !broadcasterId) {
            // If no API client, add participants without tier information
            const userIdsToProcess = Array.from(pendingUserIdsRef.current);
            const newParticipants: ChatParticipant[] = [];

            userIdsToProcess.forEach(userId => {
                const message = pendingMessagesRef.current.get(userId);
                if (message && !seenUserIdsRef.current.has(userId)) {
                    if (!canCollectChatParticipant(message, collectionContext())) {
                        return;
                    }
                    const participant = convertMessageToParticipant(message, {
                        keyword,
                        minimumSuscriptionTimeInMonths,
                        subscribersOnly
                    });
                    if (participant) {
                        newParticipants.push(participant);
                        seenUserIdsRef.current.add(userId);
                    }
                }
            });

            if (newParticipants.length > 0) {
                setAllParticipants(prev => [...prev, ...newParticipants]);
            }

            pendingUserIdsRef.current.clear();
            userIdsToProcess.forEach(userId => pendingMessagesRef.current.delete(userId));
            return;
        }

        isFetchingRef.current = true;
        const userIdsToProcess = Array.from(pendingUserIdsRef.current);

        try {
            const [subscriptionsResult, usersResult] = await Promise.all([
                twitchApiClient.fetchSubscriptionsByUserIds(broadcasterId, userIdsToProcess),
                twitchApiClient.fetchUsersByIds(userIdsToProcess),
            ]);

            if (subscriptionsResult.isErr()) {
                console.error("Failed to fetch subscription tiers:", subscriptionsResult.error);
            }
            if (usersResult.isErr()) {
                console.error("Failed to fetch user profiles:", usersResult.error);
            }

            const tierMap = subscriptionsResult.isOk() ? subscriptionsResult.value : null;
            const userMap = usersResult.isOk() ? usersResult.value : null;
            const newParticipants: ChatParticipant[] = [];

            userIdsToProcess.forEach(userId => {
                const message = pendingMessagesRef.current.get(userId);
                if (message && !seenUserIdsRef.current.has(userId)) {
                    if (!canCollectChatParticipant(message, collectionContext())) {
                        return;
                    }
                    const participant = convertMessageToParticipant(message, {
                        keyword,
                        minimumSuscriptionTimeInMonths,
                        subscribersOnly
                    });

                    if (participant) {
                        if (tierMap) {
                            const tier = tierMap.get(userId);
                            participant.tier = tier !== undefined ? (tier as 1000 | 2000 | 3000 | null) : null;
                        }

                        const user = userMap?.get(userId);
                        if (user?.profile_image_url) {
                            participant.avatar = user.profile_image_url;
                        }

                        newParticipants.push(participant);
                        seenUserIdsRef.current.add(userId);
                    }
                }
            });

            if (newParticipants.length > 0) {
                setAllParticipants(prev => [...prev, ...newParticipants]);
            }
        } catch (error) {
            console.error("Unexpected error processing batch:", error);
        } finally {
            // Clear processed users from queue
            userIdsToProcess.forEach(userId => {
                pendingUserIdsRef.current.delete(userId);
                pendingMessagesRef.current.delete(userId);
            });
            isFetchingRef.current = false;
        }
    }, [twitchApiClient, broadcasterId, keyword, minimumSuscriptionTimeInMonths, subscribersOnly, collectionContext]);

    // Queue a user for batch processing
    const queueUserForProcessing = useCallback((message: ChatMessage) => {
        // Skip if already seen or already queued
        if (seenUserIdsRef.current.has(message.userId) || pendingUserIdsRef.current.has(message.userId)) {
            return;
        }

        // Exclusão e broadcaster não entram na fila. A mensagem já está no painel.
        if (!canCollectChatParticipant(message, collectionContext())) {
            return;
        }

        // Add to queue
        pendingUserIdsRef.current.add(message.userId);
        pendingMessagesRef.current.set(message.userId, message);

        // Clear existing timer
        if (batchTimerRef.current) {
            clearTimeout(batchTimerRef.current);
        }

        // Check if we've reached the batch size limit
        if (pendingUserIdsRef.current.size >= BATCH_MAX_SIZE) {
            // Process immediately
            processBatch();
        } else {
            // Set timer to process after max wait time
            batchTimerRef.current = setTimeout(() => {
                processBatch();
            }, chatListenerTestOverrides?.batchMaxWaitMs ?? BATCH_MAX_WAIT_MS);
        }
    }, [processBatch, collectionContext]);

    // Connect to Twitch chat
    const connect = useCallback(async () => {
        if (clientRef.current) {
            await clientRef.current.disconnect();
        }

        setConnectionStatus("connecting");
        setError(null);

        try {
            const createClient = chatListenerTestOverrides?.createClient ?? createTwitchChatClient;
            const client = createClient(channel);

            // Event handlers
            client.on("connected", () => {
                setIsConnected(true);
                setConnectionStatus("connected");
                setError(null);
                console.log(`Connected to #${channel}`);
            });

            client.on("disconnected", () => {
                setIsConnected(false);
                setConnectionStatus("disconnected");
                console.log(`Disconnected from #${channel}`);
            });

            client.on("reconnect", () => {
                setConnectionStatus("connecting");
                console.log(`Reconnecting to #${channel}`);
            });

            client.on("message", (...args: unknown[]) => {
                const userstate = args[1] as tmi.ChatUserstate;
                const message = String(args[2] ?? "");
                const self = Boolean(args[3]);
                if (self) return; // Ignore messages from the bot itself

                const chatMessage = convertTmiMessage(userstate, message);

                // Add to messages list (keep last 100 messages)
                setMessages(prev => {
                    const newMessages = [...prev, chatMessage];
                    return newMessages.slice(-100);
                });
            });

            await client.connect();
            clientRef.current = client;

        } catch (err) {
            console.error("Failed to connect to Twitch chat:", err);
            setError(err instanceof Error ? err.message : "Unknown error");
            setConnectionStatus("error");
        }
    }, [channel]);

    // Disconnect from chat
    const disconnect = useCallback(async () => {
        if (clientRef.current) {
            await clientRef.current.disconnect();
            clientRef.current = null;
        }
        setIsConnected(false);
        setConnectionStatus("disconnected");
    }, []);

    // Reconnect function
    const reconnect = useCallback(() => {
        disconnect().then(() => connect());
    }, [disconnect, connect]);

    // Clear participants function
    const clearParticipants = useCallback(() => {
        setAllParticipants([]);
        setParticipants([]);
        seenUserIdsRef.current.clear();
    }, []);

    // Filter participants by name/display name
    const filterParticipants = useCallback((nameFilter: string) => {
        setNameFilter(nameFilter);
    }, []);

    // Effect to filter participants when nameFilter or allParticipants change
    useEffect(() => {
        if (!nameFilter.trim()) {
            // Se não há filtro, mostra todos os participantes
            setParticipants(allParticipants);
        } else {
            // Se há filtro, aplica a busca
            const filtered = allParticipants.filter(participant => {
                const searchTerm = nameFilter.toLowerCase();
                return (
                    participant.name.toLowerCase().includes(searchTerm) ||
                    participant.displayName.toLowerCase().includes(searchTerm)
                );
            });
            setParticipants(filtered);
        }
    }, [nameFilter, allParticipants]);

    // Effect to handle connection
    useEffect(() => {
        if (channel) {
            connect();
        }

        return () => {
            disconnect();
            // Cleanup batch timer on unmount
            if (batchTimerRef.current) {
                clearTimeout(batchTimerRef.current);
            }
        };
    }, [channel, connect, disconnect]);

    // Effect to update participants when new messages arrive
    useEffect(() => {
        if (messages.length === 0) return;

        const lastMessage = messages[messages.length - 1];

        // Queue user for batch processing instead of immediately adding
        queueUserForProcessing(lastMessage);
    }, [messages, queueUserForProcessing]);

    // Effect to re-filter all participants when keyword or tier requirements change
    // (excluding messages from dependencies to avoid reprocessing on every message).
    // A exclusão fica de fora de propósito: mudar a lista não zera a coleta.
    useEffect(() => {
        // Only reprocess when criteria change, not when messages change
        const currentMessages = messages;

        // Clear pending queue and timers when criteria change
        if (batchTimerRef.current) {
            clearTimeout(batchTimerRef.current);
            batchTimerRef.current = null;
        }
        pendingUserIdsRef.current.clear();
        pendingMessagesRef.current.clear();
        seenUserIdsRef.current.clear();

        // Requeue all messages for processing with new criteria
        currentMessages.forEach(message => {
            queueUserForProcessing(message);
        });

        // Clear participants - they will be re-added through batch processing
        setAllParticipants([]);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [keyword, minimumSuscriptionTimeInMonths, subscribersOnly]);

    return {
        participants,
        allParticipants,
        messages,
        isConnected,
        connectionStatus,
        error,
        reconnect,
        clearParticipants,
        filterParticipants,
        nameFilter,
    };
}
