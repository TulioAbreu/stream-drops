export interface ChatGiveawayForm {
    title: string;
    description: string;
    keyword: string;
    minimumSuscriptionTimeInMonths: number;
    subscriberMultiplier: number;
    subscribersOnly: boolean;
}

export interface ChatParticipant {
    id: string;
    name: string;
    displayName: string;
    avatar: string;
    subscriber: boolean;
    subscriptionMonths?: number;
    tier?: null | 1000 | 2000 | 3000;
    joinedAt: number; // timestamp in milliseconds
}

export type { GiveawayChatMessage as ChatMessage } from "@/components/giveaway/types";

