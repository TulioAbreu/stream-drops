import { useEffect, useState, useCallback, useRef } from "react";
import tmi from "tmi.js";
import type { ChatMessage, ChatParticipant } from "../types";
import type { TwitchSubscriptionTier } from "@/service/twitch/types";

interface UseChatListenerOptions {
    channel: string;
    keyword: string;
    minimumTier: TwitchSubscriptionTier | "free";
}

interface UseChatListenerReturn {
    participants: ChatParticipant[];
    messages: ChatMessage[];
    isConnected: boolean;
    connectionStatus: "connecting" | "connected" | "disconnected" | "error";
    error: string | null;
    reconnect: () => void;
    clearParticipants: () => void;
}

export function useChatListener({
    channel,
    keyword,
    minimumTier
}: UseChatListenerOptions): UseChatListenerReturn {
    const [participants, setParticipants] = useState<ChatParticipant[]>([]);
    const [messages, setMessages] = useState<ChatMessage[]>([]);
    const [isConnected, setIsConnected] = useState(false);
    const [connectionStatus, setConnectionStatus] = useState<"connecting" | "connected" | "disconnected" | "error">("disconnected");
    const [error, setError] = useState<string | null>(null);
    
    const clientRef = useRef<tmi.Client | null>(null);

    // Function to determine user tier based on badges
    const getUserTier = useCallback((badges: tmi.Badges | undefined): TwitchSubscriptionTier | "free" => {
        if (!badges) return "free";
        
        if (badges.subscriber) {
            // Subscriber badge format is typically "tier/months"
            // We need to check the tier from the badge info
            const subscriberBadge = badges.subscriber;
            if (subscriberBadge.includes("3")) return "3000";
            if (subscriberBadge.includes("2")) return "2000";
            if (subscriberBadge.includes("1")) return "1000";
            return "1000"; // Default to tier 1 if subscriber but unclear tier
        }
        
        return "free";
    }, []);

    // Function to check if user meets minimum tier requirement
    const meetsMinimumTier = useCallback((userTier: TwitchSubscriptionTier | "free"): boolean => {
        if (minimumTier === "free") return true;
        
        const tierOrder: Record<TwitchSubscriptionTier | "free", number> = {
            "free": 0,
            "1000": 1,
            "2000": 2,
            "3000": 3,
        };
        
        return tierOrder[userTier] >= tierOrder[minimumTier];
    }, [minimumTier]);

    // Function to convert TMI message to our ChatMessage format
    const convertTmiMessage = useCallback((
        userstate: tmi.ChatUserstate,
        message: string
    ): ChatMessage => {
        const tier = getUserTier(userstate.badges);
        
        return {
            id: `${userstate.id || Date.now()}-${Math.random()}`,
            userId: userstate["user-id"] || "unknown",
            userName: userstate.username || "unknown",
            displayName: userstate["display-name"] || userstate.username || "Unknown",
            avatar: `https://static-cdn.jtvnw.net/user-default-pictures-uv/ebe4cd89-b4f4-4cd9-adac-2f30151b4209-profile_image-70x70.png`,
            message: message,
            timestamp: new Date().toISOString(),
            tier: tier,
        };
    }, [getUserTier]);

    // Function to convert ChatMessage to ChatParticipant if it contains keyword
    const convertMessageToParticipant = useCallback((
        chatMessage: ChatMessage
    ): ChatParticipant | null => {
        // Check if message contains the keyword
        if (!chatMessage.message.toLowerCase().includes(keyword.toLowerCase())) {
            return null;
        }

        // Check if user meets minimum tier requirement
        if (!meetsMinimumTier(chatMessage.tier)) {
            return null;
        }

        return {
            id: chatMessage.userId,
            name: chatMessage.userName,
            displayName: chatMessage.displayName,
            avatar: chatMessage.avatar,
            tier: chatMessage.tier,
            message: chatMessage.message,
            timestamp: chatMessage.timestamp,
        };
    }, [keyword, meetsMinimumTier]);

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

                // Check if this message creates a participant
                const participant = convertMessageToParticipant(chatMessage);
                if (participant) {
                    setParticipants(prev => {
                        // Remove duplicates by user ID, keep the latest entry
                        const filtered = prev.filter(p => p.id !== participant.id);
                        return [...filtered, participant];
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
        setParticipants([]);
    }, []);

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

        setParticipants(newParticipants);
    }, [messages, convertMessageToParticipant]);

    return {
        participants,
        messages,
        isConnected,
        connectionStatus,
        error,
        reconnect,
        clearParticipants,
    };
}