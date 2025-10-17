import type { TwitchSubscriptionTier } from "@/service/twitch/types";

export interface ChatGiveawayForm {
    title: string;
    description: string;
    keyword: string;
    cost: number;
    minimumTier: TwitchSubscriptionTier | "free";
    subscriberMultiplier: Record<TwitchSubscriptionTier, number>;
}

export interface ChatParticipant {
    id: string;
    name: string;
    displayName: string;
    avatar: string;
    tier: TwitchSubscriptionTier | "free";
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
    tier: TwitchSubscriptionTier | "free";
}
