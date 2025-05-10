export type SubscriberTier = typeof SubscriberTier[keyof typeof SubscriberTier];

export const SubscriberTier = {
    FREE: 0,
    TIER_1: 1000,
    TIER_2: 2000,
    TIER_3: 3000,
} as const;

export const SubscriberTierLabels: Record<
    typeof SubscriberTier[keyof typeof SubscriberTier],
    string
> = {
    [SubscriberTier.FREE]: "Free",
    [SubscriberTier.TIER_1]: "Tier 1",
    [SubscriberTier.TIER_2]: "Tier 2",
    [SubscriberTier.TIER_3]: "Tier 3",
} as const;
