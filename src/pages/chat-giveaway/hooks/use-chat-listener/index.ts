import { useEffect, useState, useCallback, useRef } from "react";
import tmi from "tmi.js";
import type { ChatMessage, ChatParticipant } from "../../types";
import { convertTmiMessage, convertMessageToParticipant } from "./utils";

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
        // Create a reversed copy to avoid mutating the original array
        [...messages].reverse().forEach(message => {
            if (!seenUserIds.has(message.userId)) {
                const participant = convertMessageToParticipant(message, {
                    keyword,
                    minimumSuscriptionTimeInMonths,
                    subscribersOnly
                });
                if (participant) {
                    newParticipants.push(participant); // Add to end, array is reversed so newest appear first
                    seenUserIds.add(message.userId);
                }
            }
        });

        setAllParticipants(newParticipants);
    }, [messages, keyword, minimumSuscriptionTimeInMonths, subscribersOnly]);

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
