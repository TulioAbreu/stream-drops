import { useEffect, useRef, useState } from "react";
import type { GiveawayChatMessage } from "./types";

interface ChatContainerProps {
  messages: GiveawayChatMessage[];
  className?: string;
  renderMessage?: (message: GiveawayChatMessage) => React.ReactNode;
  emptyState?: React.ReactNode;
}

export function ChatContainer({
  messages,
  className,
  renderMessage,
  emptyState,
}: ChatContainerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [autoScroll, setAutoScroll] = useState(true);
  const lastMessageCountRef = useRef(messages.length);

  const checkIfNearBottom = () => {
    if (!containerRef.current) return false;

    const { scrollTop, scrollHeight, clientHeight } = containerRef.current;
    const scrollBottom = scrollHeight - scrollTop - clientHeight;
    const approximateFiveMessagesHeight = 300;

    return scrollBottom <= approximateFiveMessagesHeight;
  };

  const handleScroll = () => {
    setAutoScroll(checkIfNearBottom());
  };

  const scrollToBottom = () => {
    if (containerRef.current) {
      containerRef.current.scrollTop = containerRef.current.scrollHeight;
    }
  };

  useEffect(() => {
    if (messages.length > lastMessageCountRef.current && autoScroll) {
      scrollToBottom();
    }

    lastMessageCountRef.current = messages.length;
  }, [messages, autoScroll]);

  useEffect(() => {
    scrollToBottom();
  }, []);

  const defaultRenderMessage = (msg: GiveawayChatMessage) => (
    <div key={msg.id} className="flex justify-end mb-3">
      <div className="bg-primary/10 border border-primary/20 rounded-2xl px-4 py-2 max-w-[85%]">
        <p className="text-sm break-words">{msg.message}</p>
        <p className="text-xs text-muted-foreground mt-1 text-right">
          {new Date(msg.timestamp).toLocaleTimeString("pt-BR")}
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
