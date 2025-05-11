export interface TwitchPagination<T> {
    data: T[];
    pagination: {
        cursor: string;
    };
    total: number;
    points: number;
}

export type TwitchSubscriptionTier = "1000" | "2000" | "3000";
