import type {
  ChannelPointsParticipant,
  ChannelPointsWinner,
} from "@/database/ChannelPointsGiveaway";

export interface DrawChannelPointsWinnerParams {
  participants: ChannelPointsParticipant[];
  winners: ChannelPointsWinner[];
  allowMultipleWins: boolean;
}

export interface DrawChannelPointsWinnerResult {
  participant: ChannelPointsParticipant;
  redemptionId: string;
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

export function drawChannelPointsWinner({
  participants,
  winners,
  allowMultipleWins,
}: DrawChannelPointsWinnerParams): DrawChannelPointsWinnerResult | null {
  const ticketPool: Array<{
    participant: ChannelPointsParticipant;
    redemptionId: string;
  }> = [];

  for (const participant of participants) {
    const consumed = getConsumedRedemptionIds(
      winners,
      allowMultipleWins,
      participant.userId
    );

    if (consumed.has("*")) {
      continue;
    }

    for (const ticket of participant.tickets) {
      if (!consumed.has(ticket.redemptionId)) {
        ticketPool.push({
          participant,
          redemptionId: ticket.redemptionId,
        });
      }
    }
  }

  if (ticketPool.length === 0) {
    return null;
  }

  const index = Math.floor(Math.random() * ticketPool.length);
  return ticketPool[index];
}

export function getAvailableTicketCount(
  participants: ChannelPointsParticipant[],
  winners: ChannelPointsWinner[],
  allowMultipleWins: boolean
): number {
  let count = 0;

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
      (t) => !consumed.has(t.redemptionId)
    ).length;
  }

  return count;
}
