import type { TwitchSubscriptionTier, SubscriptionTierWithFree } from "@/service/twitch/types";

export interface ChatGiveawayForm {
    title: string;
    description: string;
    keyword: string;
    cost: number;
    minimumTier: SubscriptionTierWithFree;
    subscriberMultiplier: Record<TwitchSubscriptionTier, number>;
}

export interface ChatParticipant {
    id: string;
    name: string;
    displayName: string;
    avatar: string;
    tier: SubscriptionTierWithFree;
    message: string;
    timestamp: string;
}

export interface ChatMessage {
    id: string;
    userId: string;
    userName: string;
    displayName: string;
    avatar: string;
    message: string;
    timestamp: string;
    tier: SubscriptionTierWithFree;
}
