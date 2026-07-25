import type { BroadcasterSubscriber, TwitchSubscriptionTier } from "../twitch/types";

interface Ticket {
    id: number;
    participant: BroadcasterSubscriber;
    appliedLuck: number;
}

interface GiveawayParams {
    participants: BroadcasterSubscriber[];
    winners: BroadcasterSubscriber[];
    repeatWinners: boolean;
    requiredSubscriber: number;
    subscriberMultiplier: Record<TwitchSubscriptionTier, number>;
    totalWinners: number;
}

export function getGiveawayResult(params: GiveawayParams): BroadcasterSubscriber[] {
    let participants = params.participants;

    if (!params.repeatWinners) {
        participants = participants.filter((participant) => {
            return !params.winners.some((winner) => winner.user_id === participant.user_id);
        });
    }

    let tickets = participants.map((participant, index) => createTicket(index, participant));

    if (params.requiredSubscriber > 0) {
        tickets = tickets.filter((ticket) => {
            const tier = ticket.participant.tier;
            return Number(tier) >= params.requiredSubscriber;
        });
    }

    if (Object.values(params.subscriberMultiplier).some((multiplier) => multiplier > 1)) {
        tickets = tickets.flatMap((ticket) => {
            const multiplier = params.subscriberMultiplier[ticket.participant.tier as TwitchSubscriptionTier] || 1;
            ticket.appliedLuck = multiplier;
            return Array(multiplier).fill(ticket);
        });
    }

    const winners: Ticket[] = [];
    do {
        const randomIndex = Math.floor(Math.random() * tickets.length);
        const winner = tickets[randomIndex];
        winners.push(winner);

        tickets = tickets.filter((ticket) => ticket.participant.user_id !== winner.participant.user_id);

    } while (winners.length < params.totalWinners && tickets.length > 0);

    return winners.map((winner) => winner.participant);
}

function createTicket(id: number, participant: BroadcasterSubscriber): Ticket {
    return {
        id,
        participant,
        appliedLuck: 1,
    };
}
