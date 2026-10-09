import type { ChatMessage } from "../../types";

export function isBroadcasterChatUser(
  user: { userId: string; userName: string },
  broadcasterId: string | undefined,
  channel: string | undefined,
): boolean {
  if (broadcasterId && user.userId === broadcasterId) {
    return true;
  }

  const normalizedChannel = channel?.replace(/^#/, "").trim().toLowerCase();
  if (!normalizedChannel) {
    return false;
  }

  return user.userName.trim().toLowerCase() === normalizedChannel;
}

/** Exclusão e broadcaster não entram na coleta. A mensagem em si continua no painel. */
export function canCollectChatParticipant(
  message: Pick<ChatMessage, "userId" | "userName">,
  context: {
    excludedUserIds: ReadonlySet<string>;
    broadcasterId?: string;
    channel?: string;
  },
): boolean {
  if (isBroadcasterChatUser(message, context.broadcasterId, context.channel)) {
    return false;
  }
  return !context.excludedUserIds.has(message.userId);
}
