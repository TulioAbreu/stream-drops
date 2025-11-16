import { useEffect, useState, useCallback, useRef } from "react";
import tmi from "tmi.js";
import type { ChatMessage, ChatParticipant } from "../../types";
import { parseBadgeRaw } from "./utils";

interface UseChatListenerOptions {
    channel: string;
    keyword: string;
    minimumSuscriptionTimeInMonths?: number;
    subscribersOnly?: boolean;
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
    subscribersOnly = false
}: UseChatListenerOptions): UseChatListenerReturn {
    const [allParticipants, setAllParticipants] = useState<ChatParticipant[]>([]);
    const [participants, setParticipants] = useState<ChatParticipant[]>([]);
    const [nameFilter, setNameFilter] = useState<string>("");
    const [messages, setMessages] = useState<ChatMessage[]>([]);
    const [isConnected, setIsConnected] = useState(false);
    const [connectionStatus, setConnectionStatus] = useState<"connecting" | "connected" | "disconnected" | "error">("disconnected");
    const [error, setError] = useState<string | null>(null);
    
    const clientRef = useRef<tmi.Client | null>(null);


    // Function to convert TMI message to our ChatMessage format
    const convertTmiMessage = useCallback((
        userstate: tmi.ChatUserstate,
        message: string
    ): ChatMessage => {
        console.log("Userstate:", userstate);

        const badgeInfo = parseBadgeRaw(userstate["badge-info-raw"] ?? "");
        const rawSubscriptionMonths = badgeInfo["founder"] ?? userstate["badge-info"]?.subscriber;
        let subscriptionMonths = undefined;
        if (rawSubscriptionMonths) {
            const parsed = parseInt(rawSubscriptionMonths, 10);
            if (!isNaN(parsed)) {
                subscriptionMonths = parsed;
            }
        }

        return {
            id: `${userstate.id || Date.now()}-${Math.random()}`,
            userId: userstate["user-id"] || "unknown",
            userName: userstate.username || "unknown",
            displayName: userstate["display-name"] || userstate.username || "Unknown",
            avatar: `https://static-cdn.jtvnw.net/user-default-pictures-uv/ebe4cd89-b4f4-4cd9-adac-2f30151b4209-profile_image-70x70.png`,
            message: message,
            timestamp: new Date().toISOString(),
            subscriber: userstate.subscriber || false,
            subscriptionMonths: subscriptionMonths,
        };
    }, []);

    // Function to convert ChatMessage to ChatParticipant if it contains keyword
    const convertMessageToParticipant = useCallback((
        chatMessage: ChatMessage
    ): ChatParticipant | null => {
        // Check if message contains the keyword
        if (keyword.length > 0 && !chatMessage.message.toLowerCase().includes(keyword.toLowerCase())) {
            return null;
        }

        // Check if subscribersOnly is enabled and user is not a subscriber
        if (subscribersOnly && !chatMessage.subscriber) {
            return null;
        }

        // Check if user meets minimum subscription time requirement
        if (minimumSuscriptionTimeInMonths > 0) {
            // If subscription months is undefined or less than minimum, exclude
            if (!chatMessage.subscriptionMonths || chatMessage.subscriptionMonths < minimumSuscriptionTimeInMonths) {
                return null;
            }
        }

        return {
            id: chatMessage.userId,
            name: chatMessage.userName,
            displayName: chatMessage.displayName,
            subscriber: chatMessage.subscriber,
            avatar: chatMessage.avatar,
            message: chatMessage.message,
            timestamp: chatMessage.timestamp,
        };
    }, [keyword, minimumSuscriptionTimeInMonths, subscribersOnly]);

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
                channels: ["jstern25"]
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

                // Check if this message creates a participant
                const participant = convertMessageToParticipant(chatMessage);
                if (participant) {
                    setAllParticipants(prev => {
                        // Remove duplicates by user ID, keep the latest entry
                        const filtered = prev.filter(p => p.id !== participant.id);
                        // Add to the beginning so newest participants appear first
                        return [participant, ...filtered];
                    });
                }
            });

            await client.connect();
            clientRef.current = client;

        } catch (err) {
            console.error("Failed to connect to Twitch chat:", err);
            setError(err instanceof Error ? err.message : "Unknown error");
            setConnectionStatus("error");
        }
    }, [channel, convertTmiMessage, convertMessageToParticipant]);

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
        };
    }, [channel, connect, disconnect]);

    // Effect to update participants when keyword or tier requirements change
    useEffect(() => {
        // Re-filter existing messages when keyword or tier requirements change
        const newParticipants: ChatParticipant[] = [];
        const seenUserIds = new Set<string>();

        // Process messages in reverse order to get the latest entry for each user
        messages.reverse().forEach(message => {
            if (!seenUserIds.has(message.userId)) {
                const participant = convertMessageToParticipant(message);
                if (participant) {
                    newParticipants.unshift(participant); // Add to beginning to maintain chronological order
                    seenUserIds.add(message.userId);
                }
            }
        });

        setAllParticipants(newParticipants);
    }, [messages, convertMessageToParticipant]);

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
