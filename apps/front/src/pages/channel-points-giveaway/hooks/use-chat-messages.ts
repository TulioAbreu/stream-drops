import { useEffect, useRef, useState } from "react";
import tmi from "tmi.js";
import type { GiveawayChatMessage } from "@/components/giveaway/types";
import { parseBadgeRaw, parseSubscriptionMonths } from "@/pages/chat-giveaway/hooks/use-chat-listener/utils";

const MAX_MESSAGES = 100;

interface UseChatMessagesOptions {
  channel: string;
  enabled?: boolean;
}

interface UseChatMessagesReturn {
  messages: GiveawayChatMessage[];
  connectionStatus: "connecting" | "connected" | "disconnected" | "error";
}

function toChatMessage(
  userstate: tmi.ChatUserstate,
  message: string
): GiveawayChatMessage {
  const badgeInfo = parseBadgeRaw(userstate["badge-info-raw"] ?? "");
  const subscriptionMonths = parseSubscriptionMonths(
    badgeInfo,
    userstate["badge-info"] as Record<string, string | undefined> | undefined
  );

  return {
    id: `${userstate.id || Date.now()}-${Math.random()}`,
    userId: userstate["user-id"] || "unknown",
    userName: userstate.username || "unknown",
    displayName:
      userstate["display-name"] || userstate.username || "Unknown",
    avatar:
      "https://static-cdn.jtvnw.net/user-default-pictures-uv/ebe4cd89-b4f4-4cd9-adac-2f30151b4209-profile_image-70x70.png",
    message,
    timestamp: new Date().toISOString(),
    subscriber: userstate.subscriber || false,
    subscriptionMonths,
  };
}

/** Lightweight IRC listener used for winner confirmation timer (messages only). */
export function useChatMessages({
  channel,
  enabled = true,
}: UseChatMessagesOptions): UseChatMessagesReturn {
  const [messages, setMessages] = useState<GiveawayChatMessage[]>([]);
  const [connectionStatus, setConnectionStatus] = useState<
    "connecting" | "connected" | "disconnected" | "error"
  >("disconnected");
  const clientRef = useRef<tmi.Client | null>(null);

  useEffect(() => {
    if (!enabled || !channel) {
      setConnectionStatus("disconnected");
      return;
    }

    let cancelled = false;
    setConnectionStatus("connecting");

    const client = new tmi.Client({
      channels: [channel],
      connection: { reconnect: true, secure: true },
    });
    clientRef.current = client;

    client.on("connected", () => {
      if (!cancelled) setConnectionStatus("connected");
    });

    client.on("disconnected", () => {
      if (!cancelled) setConnectionStatus("disconnected");
    });

    client.on("message", (_channel, userstate, message, self) => {
      if (self || cancelled) return;
      const chatMessage = toChatMessage(userstate, message);
      setMessages((prev) => {
        const next = [...prev, chatMessage];
        return next.length > MAX_MESSAGES
          ? next.slice(next.length - MAX_MESSAGES)
          : next;
      });
    });

    client.connect().catch(() => {
      if (!cancelled) setConnectionStatus("error");
    });

    return () => {
      cancelled = true;
      client.disconnect().catch(() => {});
      clientRef.current = null;
    };
  }, [channel, enabled]);

  return { messages, connectionStatus };
}
