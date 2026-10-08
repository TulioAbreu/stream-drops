import { makeUserKey } from "./order";
import type { SubscriptionTier, WinContext, WinEvent } from "./types";

export type WinnerHistorySource = {
  chat?: unknown;
  channelPoints?: unknown;
  subscribers?: unknown;
};

const TIERS = new Set<SubscriptionTier>(["1000", "2000", "3000"]);

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }
  return value as Record<string, unknown>;
}

function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function readString(
  record: Record<string, unknown>,
  key: string,
): string | undefined {
  const value = record[key];
  if (typeof value !== "string") return undefined;
  return value;
}

function readPlatform(
  winner: Record<string, unknown>,
  giveaway: Record<string, unknown>,
): string {
  const platform =
    readString(winner, "platform") ?? readString(giveaway, "platform");
  if (!platform || platform.trim().length === 0) return "twitch";
  return platform.trim();
}

function normalizeMonths(value: unknown): number | undefined {
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0) {
    return undefined;
  }
  return Math.floor(value);
}

function normalizeTier(value: unknown): SubscriptionTier | undefined {
  const asString =
    typeof value === "number" && Number.isFinite(value)
      ? String(value)
      : value;
  if (typeof asString === "string" && TIERS.has(asString as SubscriptionTier)) {
    return asString as SubscriptionTier;
  }
  return undefined;
}

function buildContext(raw: {
  subscriptionMonths: unknown;
  tier: unknown;
  isGift: unknown;
}): WinContext | undefined {
  const context: WinContext = {};
  const months = normalizeMonths(raw.subscriptionMonths);
  if (months !== undefined) context.subscriptionMonths = months;
  const tier = normalizeTier(raw.tier);
  if (tier) context.tier = tier;
  if (raw.isGift === true) context.isGift = true;
  if (
    context.subscriptionMonths === undefined &&
    context.tier === undefined &&
    context.isGift === undefined
  ) {
    return undefined;
  }
  return context;
}

function readWonAt(record: Record<string, unknown>): string | undefined {
  const drawnAt = record.drawnAt;
  if (typeof drawnAt !== "string" || drawnAt.length === 0) return undefined;
  if (!Number.isFinite(Date.parse(drawnAt))) return undefined;
  return drawnAt;
}

function readAvatar(record: Record<string, unknown>): string | undefined {
  const avatar = readString(record, "avatar");
  if (!avatar) return undefined;
  return avatar;
}

function isUnknownUser(userId: string | undefined): boolean {
  return !userId || userId === "unknown";
}

function indexParticipants(
  giveaway: Record<string, unknown>,
): Map<string, Record<string, unknown>> {
  const indexed = new Map<string, Record<string, unknown>>();
  for (const item of asArray(giveaway.participants)) {
    const record = asRecord(item);
    if (!record) continue;
    const id = readString(record, "id") ?? readString(record, "userId");
    if (!id || indexed.has(id)) continue;
    indexed.set(id, record);
  }
  return indexed;
}

function chatContext(
  winner: Record<string, unknown>,
  participants: Map<string, Record<string, unknown>>,
  twitchId: string,
): WinContext | undefined {
  const explicit = asRecord(winner.context);
  if (explicit) {
    return buildContext({
      subscriptionMonths: explicit.subscriptionMonths,
      tier: explicit.tier,
      isGift: explicit.isGift,
    });
  }
  if (winner.context != null) return undefined;
  const participant = participants.get(twitchId);
  if (!participant) return undefined;
  return buildContext({
    subscriptionMonths: participant.subscriptionMonths,
    tier: participant.tier,
    isGift: participant.isGift,
  });
}

function pushWin(
  target: WinEvent[],
  event: Omit<WinEvent, "userKey" | "platform"> & {
    platform: string;
    userId: string;
  },
): void {
  if (isUnknownUser(event.userId)) return;
  target.push({
    ...event,
    userKey: makeUserKey(event.platform, event.userId),
  });
}

function normalizeChat(value: unknown): WinEvent[] {
  const events: WinEvent[] = [];
  for (const item of asArray(value)) {
    const giveaway = asRecord(item);
    if (!giveaway) continue;
    const giveawayId = readString(giveaway, "id");
    if (!giveawayId) continue;
    const participants = indexParticipants(giveaway);
    asArray(giveaway.winners).forEach((winnerValue, index) => {
      const winner = asRecord(winnerValue);
      if (!winner) return;
      const userId = readString(winner, "twitchId");
      if (isUnknownUser(userId) || !userId) return;
      pushWin(events, {
        platform: readPlatform(winner, giveaway),
        userId,
        giveawayType: "chat",
        giveawayId,
        index,
        wonAt: readWonAt(winner),
        name: readString(winner, "name") ?? "",
        avatar: readAvatar(winner),
        context: chatContext(winner, participants, userId),
      });
    });
  }
  return events;
}

function normalizeChannelPoints(value: unknown): WinEvent[] {
  const events: WinEvent[] = [];
  for (const item of asArray(value)) {
    const giveaway = asRecord(item);
    if (!giveaway) continue;
    const giveawayId = readString(giveaway, "id");
    if (!giveawayId) continue;
    asArray(giveaway.winners).forEach((winnerValue, index) => {
      const winner = asRecord(winnerValue);
      if (!winner) return;
      const userId = readString(winner, "userId");
      if (isUnknownUser(userId) || !userId) return;
      pushWin(events, {
        platform: readPlatform(winner, giveaway),
        userId,
        giveawayType: "channel-points",
        giveawayId,
        index,
        wonAt: readWonAt(winner),
        name: readString(winner, "name") ?? "",
        avatar: readAvatar(winner),
      });
    });
  }
  return events;
}

function normalizeSubscribers(value: unknown): WinEvent[] {
  const events: WinEvent[] = [];
  for (const item of asArray(value)) {
    const giveaway = asRecord(item);
    if (!giveaway) continue;
    const giveawayId = readString(giveaway, "id");
    if (!giveawayId) continue;
    asArray(giveaway.winners).forEach((winnerValue, index) => {
      const winner = asRecord(winnerValue);
      if (!winner) return;
      const userId = readString(winner, "user_id");
      if (isUnknownUser(userId) || !userId) return;
      const name =
        readString(winner, "user_name") ??
        readString(winner, "user_login") ??
        "";
      pushWin(events, {
        platform: readPlatform(winner, giveaway),
        userId,
        giveawayType: "subscribers",
        giveawayId,
        index,
        wonAt: readWonAt(winner),
        name,
        avatar: readAvatar(winner),
        context: buildContext({
          subscriptionMonths: winner.subscriptionMonths,
          tier: winner.tier,
          isGift: winner.is_gift,
        }),
      });
    });
  }
  return events;
}

/**
 * Lê os três formatos v12 sem lançar em campo ausente ou nulo.
 * Não muta a entrada e não persiste nada.
 */
export function normalizeWinnerHistory(
  source: WinnerHistorySource | null | undefined,
): WinEvent[] {
  if (!source) return [];
  return [
    ...normalizeChat(source.chat),
    ...normalizeChannelPoints(source.channelPoints),
    ...normalizeSubscribers(source.subscribers),
  ];
}
