import { useEffect, useState, useCallback, useRef } from "react";
import tmi from "tmi.js";
import type { ChatMessage, ChatParticipant } from "../../types";
import { convertTmiMessage, convertMessageToParticipant } from "./utils";
import type { makeTwitchApiClient } from "@/service/twitch";

// Configurable constant for batch processing max wait time
const BATCH_MAX_WAIT_MS = 1500; // 2 seconds
const BATCH_MAX_SIZE = 100; // Twitch API limit

interface UseChatListenerOptions {
    channel: string;
    keyword: string;
    minimumSuscriptionTimeInMonths?: number;
    subscribersOnly?: boolean;
    twitchApiClient?: ReturnType<typeof makeTwitchApiClient>;
    broadcasterId?: string;
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
    broadcasterId
}: UseChatListenerOptions): UseChatListenerReturn {
    const [allParticipants, setAllParticipants] = useState<ChatParticipant[]>([]);
    const [participants, setParticipants] = useState<ChatParticipant[]>([]);
    const [nameFilter, setNameFilter] = useState<string>("");
    const [messages, setMessages] = useState<ChatMessage[]>([]);
    const [isConnected, setIsConnected] = useState(false);
    const [connectionStatus, setConnectionStatus] = useState<"connecting" | "connected" | "disconnected" | "error">("disconnected");
    const [error, setError] = useState<string | null>(null);

    const clientRef = useRef<tmi.Client | null>(null);
    const seenUserIdsRef = useRef<Set<string>>(new Set());

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
            // Fetch subscription tiers for batch of users
            const result = await twitchApiClient.fetchSubscriptionsByUserIds(
                broadcasterId,
                userIdsToProcess
            );

            if (result.isErr()) {
                console.error("Failed to fetch subscription tiers:", result.error);

                // On error, add participants without tier information
                const newParticipants: ChatParticipant[] = [];
                userIdsToProcess.forEach(userId => {
                    const message = pendingMessagesRef.current.get(userId);
                    if (message && !seenUserIdsRef.current.has(userId)) {
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
            } else {
                // Success: enrich participants with tier information
                const tierMap = result.value;
                const newParticipants: ChatParticipant[] = [];

                userIdsToProcess.forEach(userId => {
                    const message = pendingMessagesRef.current.get(userId);
                    if (message && !seenUserIdsRef.current.has(userId)) {
                        const participant = convertMessageToParticipant(message, {
                            keyword,
                            minimumSuscriptionTimeInMonths,
                            subscribersOnly
                        });

                        if (participant) {
                            // Add tier information from API result
                            const tier = tierMap.get(userId);
                            participant.tier = tier !== undefined ? (tier as 1000 | 2000 | 3000 | null) : null;

                            newParticipants.push(participant);
                            seenUserIdsRef.current.add(userId);
                        }
                    }
                });

                if (newParticipants.length > 0) {
                    setAllParticipants(prev => [...prev, ...newParticipants]);
                }
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
    }, [twitchApiClient, broadcasterId, keyword, minimumSuscriptionTimeInMonths, subscribersOnly]);

    // Queue a user for batch processing
    const queueUserForProcessing = useCallback((message: ChatMessage) => {
        // Skip if already seen or already queued
        if (seenUserIdsRef.current.has(message.userId) || pendingUserIdsRef.current.has(message.userId)) {
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
            }, BATCH_MAX_WAIT_MS);
        }
    }, [processBatch]);

    // Connect to Twitch chat
    const connect = useCallback(async () => {
        if (clientRef.current) {
            await clientRef.current.disconnect();
        }

        setConnectionStatus("connecting");
        setError(null);

        try {
            const client = new tmi.Client({
                options: { debug: false },
                connection: {
                    reconnect: true,
                    secure: true,
                },
                channels: [channel]
            });

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

            client.on("message", (_channel, userstate, message, self) => {
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
    // (excluding messages from dependencies to avoid reprocessing on every message)
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
