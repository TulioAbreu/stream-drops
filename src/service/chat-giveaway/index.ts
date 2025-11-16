import type { ChatParticipant } from "@/pages/chat-giveaway/types";

export interface DrawWinnerParams {
    participants: ChatParticipant[];
    subscriberMultiplier: number;
    excludeIds?: string[];
}

export function drawWinner({ participants, subscriberMultiplier, excludeIds = [] }: DrawWinnerParams): ChatParticipant | null {
    // Filter out already drawn winners
    const eligibleParticipants = participants.filter(p => !excludeIds.includes(p.id));

    if (eligibleParticipants.length === 0) {
        return null;
    }

    // Calculate total tickets based on subscriber status
    const participantsWithTickets = eligibleParticipants.map(participant => {
        const multiplier = participant.subscriber ? subscriberMultiplier : 1;
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
