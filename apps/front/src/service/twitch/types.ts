export interface TwitchPagination<T> {
    data: T[];
    pagination: {
        cursor: string;
    };
    total: number;
    points: number;
}

export const TwitchSubscriptionTier = {
    TIER_1: "1000",
    TIER_2: "2000", 
    TIER_3: "3000"
} as const;

export type TwitchSubscriptionTier = typeof TwitchSubscriptionTier[keyof typeof TwitchSubscriptionTier];

export const SubscriptionTierWithFree = {
    FREE: "free",
    TIER_1: "1000",
    TIER_2: "2000",
    TIER_3: "3000"
} as const;

export type SubscriptionTierWithFree = typeof SubscriptionTierWithFree[keyof typeof SubscriptionTierWithFree];

export type GetTwitchBroadcasterSubscriptionsParams = {
    broadcaster_id: string;
    user_id?: string;
    first?: string;
    after?: string;
    before?: string;
}

export type BroadcasterSubscriber = {
    broadcaster_id: string;
    broadcaster_login: string;
    broadcaster_name: string;
    gifter_id: string | "";
    gifter_login: string | "";
    is_gift: boolean;
    plan_name: string;
    tier: TwitchSubscriptionTier;
    user_id: string;
    user_name: string;
    user_login: string;
};

export type GetTwitchBroadcasterSubscriptionsResponse = TwitchPagination<BroadcasterSubscriber>;

export type GetTwitchUsersParams = {
    id?: string;
    login?: string;
}

export type GetTwitchUsersResponse = {
    data: TwitchUser[];
}

export type TwitchUser = {
    id: string;
    login: string;
    display_name: string;
    type: string;
    broadcaster_type: string;
    description: string;
    profile_image_url: string;
    offline_image_url: string;
    view_count: number;
    email: string;
    created_at: string;
};

export type SendTwitchChatMessageParams = {
    broadcaster_id: string;
    sender_id: string;
    message: string;
    reply_parent_message_id?: string;
}

export type SendTwitchChatMessageResponse = {
    data: {
        message_id: string;
        is_sent: boolean;
    }[];
}
