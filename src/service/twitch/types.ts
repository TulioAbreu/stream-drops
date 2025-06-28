export interface TwitchPagination<T> {
    data: T[];
    pagination: {
        cursor: string;
    };
    total: number;
    points: number;
}

export type TwitchSubscriptionTier = "1000" | "2000" | "3000";

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
