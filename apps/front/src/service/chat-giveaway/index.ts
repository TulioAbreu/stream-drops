import type { ChatParticipant } from "@/pages/chat-giveaway/types";

export interface DrawWinnerParams {
    participants: ChatParticipant[];
    subscriberMultiplier: number;
    excludeIds?: string[];
}

export function ticketsForChatParticipant(
    participant: Pick<ChatParticipant, "subscriber">,
    subscriberMultiplier: number,
): number {
    return participant.subscriber ? subscriberMultiplier : 1;
}

export function summarizeChatDrawChance(params: {
    participants: readonly ChatParticipant[];
    winner: Pick<ChatParticipant, "subscriber">;
    subscriberMultiplier: number;
    excludeIds?: readonly string[];
}): { winnerTickets: number; totalTickets: number; winChance: number } {
    const excludeIds = params.excludeIds ?? [];
    const drawPool = params.participants.filter(
        (participant) => !excludeIds.includes(participant.id),
    );
    const winnerTickets = ticketsForChatParticipant(
        params.winner,
        params.subscriberMultiplier,
    );
    const totalTickets = drawPool.reduce(
        (sum, participant) =>
            sum + ticketsForChatParticipant(participant, params.subscriberMultiplier),
        0,
    );
    const winChance = (winnerTickets / totalTickets) * 100;
    return { winnerTickets, totalTickets, winChance };
}

export function drawWinner({ participants, subscriberMultiplier, excludeIds = [] }: DrawWinnerParams): ChatParticipant | null {
    // Filter out already drawn winners
    const eligibleParticipants = participants.filter(p => !excludeIds.includes(p.id));

    if (eligibleParticipants.length === 0) {
        return null;
    }

    // Calculate total tickets based on subscriber status
    const participantsWithTickets = eligibleParticipants.map(participant => {
        const multiplier = ticketsForChatParticipant(participant, subscriberMultiplier);
        return {
            participant,
            tickets: multiplier
        };
    });

    const totalTickets = participantsWithTickets.reduce((sum, p) => sum + p.tickets, 0);

    // Random draw
    let randomTicket = Math.random() * totalTickets;

    for (const { participant, tickets } of participantsWithTickets) {
        randomTicket -= tickets;
        if (randomTicket <= 0) {
            return participant;
        }
    }

    // Fallback to first participant if something goes wrong
    return eligibleParticipants[0];
}
