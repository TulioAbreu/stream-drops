import type {
  ChannelPointsParticipant,
  ChannelPointsWinner,
} from "@/database/ChannelPointsGiveaway";
import type { TwitchSubscriptionTier } from "@/service/twitch/types";

export type ChannelPointsSubscriberMultiplier = Record<
  TwitchSubscriptionTier,
  number
>;

export const DEFAULT_CHANNEL_POINTS_MULTIPLIER: ChannelPointsSubscriberMultiplier =
  {
    "1000": 1,
    "2000": 1,
    "3000": 1,
  };

export function normalizeChannelPointsMultiplier(
  subscriberMultiplier?: Partial<ChannelPointsSubscriberMultiplier> | null
): ChannelPointsSubscriberMultiplier {
  return {
    "1000": Math.max(
      1,
      Math.floor(Number(subscriberMultiplier?.["1000"]) || 1)
    ),
    "2000": Math.max(
      1,
      Math.floor(Number(subscriberMultiplier?.["2000"]) || 1)
    ),
    "3000": Math.max(
      1,
      Math.floor(Number(subscriberMultiplier?.["3000"]) || 1)
    ),
  };
}

/**
 * Multiplier only affects draw weight. Non-subs always count as 1.
 * One redemption still equals at most one win (see allowMultipleWins).
 */
export function resolveChannelPointsMultiplier(
  participant: ChannelPointsParticipant,
  subscriberMultiplier?: Partial<ChannelPointsSubscriberMultiplier> | null
): number {
  if (!participant.subscriber || participant.tier == null) {
    return 1;
  }

  const multipliers = normalizeChannelPointsMultiplier(subscriberMultiplier);
  const key = String(participant.tier) as TwitchSubscriptionTier;
  return multipliers[key] ?? 1;
}

export interface DrawChannelPointsWinnerParams {
  participants: ChannelPointsParticipant[];
  winners: ChannelPointsWinner[];
  allowMultipleWins: boolean;
  subscriberMultiplier?: Partial<ChannelPointsSubscriberMultiplier> | null;
  /** Session excludes (e.g. pending/reroll redemption IDs). */
  excludeRedemptionIds?: string[];
}

export interface DrawChannelPointsWinnerResult {
  participant: ChannelPointsParticipant;
  redemptionId: string;
  weight: number;
}

function getConsumedRedemptionIds(
  winners: ChannelPointsWinner[],
  allowMultipleWins: boolean,
  userId: string
): Set<string> {
  if (!allowMultipleWins) {
    const userWon = winners.some((w) => w.userId === userId);
    if (userWon) {
      return new Set(["*"]);
    }
    return new Set();
  }

  return new Set(
    winners.filter((w) => w.userId === userId).map((w) => w.redemptionId)
  );
}

function buildWeightedTicketPool({
  participants,
  winners,
  allowMultipleWins,
  subscriberMultiplier,
  excludeRedemptionIds,
}: DrawChannelPointsWinnerParams): Array<{
  participant: ChannelPointsParticipant;
  redemptionId: string;
  weight: number;
}> {
  const ticketPool: Array<{
    participant: ChannelPointsParticipant;
    redemptionId: string;
    weight: number;
  }> = [];
  const excluded = new Set(excludeRedemptionIds ?? []);

  for (const participant of participants) {
    const consumed = getConsumedRedemptionIds(
      winners,
      allowMultipleWins,
      participant.userId
    );

    if (consumed.has("*")) {
      continue;
    }

    const weight = resolveChannelPointsMultiplier(
      participant,
      subscriberMultiplier
    );

    for (const ticket of participant.tickets) {
      if (consumed.has(ticket.redemptionId)) {
        continue;
      }
      if (excluded.has(ticket.redemptionId)) {
        continue;
      }

      // Push the same redemption `weight` times for chance only.
      // A win still consumes this single redemptionId once.
      for (let i = 0; i < weight; i++) {
        ticketPool.push({
          participant,
          redemptionId: ticket.redemptionId,
          weight,
        });
      }
    }
  }

  return ticketPool;
}

export function drawChannelPointsWinner(
  params: DrawChannelPointsWinnerParams
): DrawChannelPointsWinnerResult | null {
  const ticketPool = buildWeightedTicketPool(params);

  if (ticketPool.length === 0) {
    return null;
  }

  const index = Math.floor(Math.random() * ticketPool.length);
  const drawn = ticketPool[index];
  return {
    participant: drawn.participant,
    redemptionId: drawn.redemptionId,
    weight: drawn.weight,
  };
}

/** Remaining real redemptions that can still win (not weighted). */
export function getAvailableTicketCount(
  participants: ChannelPointsParticipant[],
  winners: ChannelPointsWinner[],
  allowMultipleWins: boolean,
  excludeRedemptionIds: string[] = []
): number {
  let count = 0;
  const excluded = new Set(excludeRedemptionIds);

  for (const participant of participants) {
    const consumed = getConsumedRedemptionIds(
      winners,
      allowMultipleWins,
      participant.userId
    );

    if (consumed.has("*")) {
      continue;
    }

    count += participant.tickets.filter(
      (t) => !consumed.has(t.redemptionId) && !excluded.has(t.redemptionId)
    ).length;
  }

  return count;
}

/** Weighted entries currently in the draw pool (for chance display). */
export function getWeightedEntryCount(
  params: DrawChannelPointsWinnerParams
): number {
  return buildWeightedTicketPool(params).length;
}
