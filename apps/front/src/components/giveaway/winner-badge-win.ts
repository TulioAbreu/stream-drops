import type { ChannelPointsGiveawayFormData } from "@/database/ChannelPointsGiveaway";
import type { ChatGiveawayFormData } from "@/database/ChatGiveaway";
import { normalizeWinnerHistory } from "@/lib/winner-badges/normalize";
import type { EngineClock, GiveawayType, WinEvent } from "@/lib/winner-badges/types";
import { chatWinnerContextFromParticipant } from "@/pages/chat-giveaway/winner-context";
import type { ChatParticipant } from "@/pages/chat-giveaway/types";

type PointsPending = {
  redemptionId: string;
  participant: {
    userId: string;
    displayName: string;
    avatar: string;
  };
};

const PREVIEW_STAMP = "1970-01-01T00:00:00.000Z";

/**
 * Relógio do navegador. A prévia congela o `now` no sorteio;
 * o selo final usa o `drawnAt` gravado, não este instante.
 */
export function browserClock(now = new Date()): EngineClock {
  let timeZone = "UTC";
  try {
    const resolved = Intl.DateTimeFormat().resolvedOptions().timeZone;
    if (resolved) timeZone = resolved;
  } catch {
    timeZone = "UTC";
  }
  return { now: now.toISOString(), timeZone };
}

function winAt(
  giveawayType: GiveawayType,
  record: unknown,
  userId: string,
  index: number,
): WinEvent | null {
  if (!userId || userId === "unknown") return null;
  const source =
    giveawayType === "chat"
      ? { chat: [record] }
      : giveawayType === "channel-points"
        ? { channelPoints: [record] }
        : { subscribers: [record] };
  return (
    normalizeWinnerHistory(source).find(
      (win) =>
        win.giveawayType === giveawayType &&
        win.userId === userId &&
        win.index === index,
    ) ?? null
  );
}

/** Vitória já gravada. O índice é o do array `winners`, não o rank da tela. */
export function confirmedWin(
  giveawayType: GiveawayType,
  record: unknown,
  userId: string,
  index: number,
): WinEvent | null {
  const win = winAt(giveawayType, record, userId, index);
  if (!win) return null;
  return { ...win, preview: false };
}

/**
 * Cópia em memória do sorteio com o pendente no fim.
 * Não é o registro salvo. O `drawnAt` falso some na prévia.
 */
export function chatPreviewWin(
  giveaway: ChatGiveawayFormData,
  pending: ChatParticipant,
): WinEvent | null {
  const prior = giveaway.winners.filter(
    (winner) => winner.twitchId !== pending.id,
  );
  const draft: ChatGiveawayFormData = {
    ...giveaway,
    winners: [
      ...prior,
      {
        id: pending.id,
        name: pending.displayName,
        twitchId: pending.id,
        avatar: pending.avatar,
        drawnAt: PREVIEW_STAMP,
        context: chatWinnerContextFromParticipant(pending),
      },
    ],
  };
  const win = winAt("chat", draft, pending.id, prior.length);
  if (!win) return null;
  return { ...win, preview: true };
}

export function channelPointsPreviewWin(
  giveaway: ChannelPointsGiveawayFormData,
  pending: PointsPending,
): WinEvent | null {
  const userId = pending.participant.userId;
  const prior = giveaway.winners.filter(
    (winner) => winner.redemptionId !== pending.redemptionId,
  );
  const draft: ChannelPointsGiveawayFormData = {
    ...giveaway,
    winners: [
      ...prior,
      {
        id: "preview",
        userId,
        name: pending.participant.displayName,
        avatar: pending.participant.avatar,
        redemptionId: pending.redemptionId,
        drawnAt: PREVIEW_STAMP,
      },
    ],
  };
  const win = winAt("channel-points", draft, userId, prior.length);
  if (!win) return null;
  return { ...win, preview: true };
}
