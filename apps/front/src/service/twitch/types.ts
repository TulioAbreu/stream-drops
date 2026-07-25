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

export type TwitchCustomReward = {
    broadcaster_id: string;
    broadcaster_login: string;
    broadcaster_name: string;
    id: string;
    title: string;
    prompt: string;
    cost: number;
    image: {
        url_1x: string;
        url_2x: string;
        url_4x: string;
    } | null;
    default_image: {
        url_1x: string;
        url_2x: string;
        url_4x: string;
    };
    background_color: string;
    is_enabled: boolean;
    is_user_input_required: boolean;
    max_per_stream_setting: {
        is_enabled: boolean;
        max_per_stream: number;
    };
    max_per_user_per_stream_setting: {
        is_enabled: boolean;
        max_per_user_per_stream: number;
    };
    global_cooldown_setting: {
        is_enabled: boolean;
        global_cooldown_seconds: number;
    };
    is_paused: boolean;
    is_in_stock: boolean;
    redemptions_redeemed_current_stream: number | null;
    cooldown_expires_at: string | null;
};

export type CreateTwitchCustomRewardParams = {
    broadcaster_id: string;
    title: string;
    cost: number;
    prompt?: string;
    is_enabled?: boolean;
    background_color?: string;
    is_user_input_required?: boolean;
    is_max_per_stream_enabled?: boolean;
    max_per_stream?: number;
    is_max_per_user_per_stream_enabled?: boolean;
    max_per_user_per_stream?: number;
    is_global_cooldown_enabled?: boolean;
    global_cooldown_seconds?: number;
    should_redemptions_skip_request_queue?: boolean;
};

export type UpdateTwitchCustomRewardParams = {
    broadcaster_id: string;
    id: string;
    title?: string;
    cost?: number;
    prompt?: string;
    is_enabled?: boolean;
    background_color?: string;
    is_user_input_required?: boolean;
    is_max_per_stream_enabled?: boolean;
    max_per_stream?: number;
    is_max_per_user_per_stream_enabled?: boolean;
    max_per_user_per_stream?: number;
    is_global_cooldown_enabled?: boolean;
    global_cooldown_seconds?: number;
    is_paused?: boolean;
    should_redemptions_skip_request_queue?: boolean;
};

export type TwitchCustomRewardResponse = {
    data: TwitchCustomReward[];
};

export type TwitchRedemptionStatus = "UNFULFILLED" | "FULFILLED" | "CANCELED";

export type TwitchCustomRewardRedemption = {
    broadcaster_id: string;
    broadcaster_login: string;
    broadcaster_name: string;
    id: string;
    user_id: string;
    user_login: string;
    user_name: string;
    user_input: string;
    status: TwitchRedemptionStatus;
    redeemed_at: string;
    reward: {
        id: string;
        title: string;
        prompt: string;
        cost: number;
    };
};

export type GetTwitchCustomRewardRedemptionsParams = {
    broadcaster_id: string;
    reward_id: string;
    status?: TwitchRedemptionStatus;
    id?: string | string[];
    sort?: "OLDEST" | "NEWEST";
    after?: string;
    first?: number;
};

export type GetTwitchCustomRewardRedemptionsResponse = {
    data: TwitchCustomRewardRedemption[];
    pagination: {
        cursor?: string;
    };
};

export type UpdateTwitchRedemptionsStatusParams = {
    broadcaster_id: string;
    reward_id: string;
    ids: string[];
    status: "FULFILLED" | "CANCELED";
};

export type UpdateTwitchRedemptionsStatusResponse = {
    data: TwitchCustomRewardRedemption[];
};

export type DeleteTwitchCustomRewardParams = {
    broadcaster_id: string;
    id: string;
};
