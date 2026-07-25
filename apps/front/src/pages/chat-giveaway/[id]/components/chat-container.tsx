import { useEffect, useRef, useState } from "react";
import type { ChatMessage } from "../../types";

interface ChatContainerProps {
    messages: ChatMessage[];
    className?: string;
    renderMessage?: (message: ChatMessage) => React.ReactNode;
    emptyState?: React.ReactNode;
}

export function ChatContainer({
    messages,
    className,
    renderMessage,
    emptyState
}: ChatContainerProps) {
    const containerRef = useRef<HTMLDivElement>(null);
    const [autoScroll, setAutoScroll] = useState(true);
    const lastMessageCountRef = useRef(messages.length);

    // Check if user is near the bottom (within the last 5 messages)
    const checkIfNearBottom = () => {
        if (!containerRef.current) return false;

        const { scrollTop, scrollHeight, clientHeight } = containerRef.current;
        const scrollBottom = scrollHeight - scrollTop - clientHeight;

        // Calculate approximate height of 5 messages (assuming ~60px per message)
        const approximateFiveMessagesHeight = 300;

        return scrollBottom <= approximateFiveMessagesHeight;
    };

    // Handle scroll event
    const handleScroll = () => {
        const isNearBottom = checkIfNearBottom();
        setAutoScroll(isNearBottom);
    };

    // Scroll to bottom
    const scrollToBottom = () => {
        if (containerRef.current) {
            containerRef.current.scrollTop = containerRef.current.scrollHeight;
        }
    };

    // Auto-scroll when new messages arrive
    useEffect(() => {
        // Only scroll if we have new messages and auto-scroll is enabled
        if (messages.length > lastMessageCountRef.current && autoScroll) {
            scrollToBottom();
        }

        lastMessageCountRef.current = messages.length;
    }, [messages, autoScroll]);

    // Initial scroll to bottom when component mounts
    useEffect(() => {
        scrollToBottom();
    }, []);

    // Default message renderer
    const defaultRenderMessage = (msg: ChatMessage) => (
        <div key={msg.id} className="flex justify-end mb-3">
            <div className="bg-primary/10 border border-primary/20 rounded-2xl px-4 py-2 max-w-[85%]">
                <p className="text-sm break-words">{msg.message}</p>
                <p className="text-xs text-muted-foreground mt-1 text-right">
                    {new Date(msg.timestamp).toLocaleTimeString('pt-BR')}
                </p>
            </div>
        </div>
    );

    return (
        <div
            ref={containerRef}
            className={className}
            onScroll={handleScroll}
        >
            <div className="p-3 space-y-2">
                {messages.length === 0 ? (
                    emptyState || (
                        <p className="text-center text-muted-foreground text-sm py-8">
                            Nenhuma mensagem ainda
                        </p>
                    )
                ) : (
                    messages.map(renderMessage || defaultRenderMessage)
                )}
            </div>
        </div>
    );
}
