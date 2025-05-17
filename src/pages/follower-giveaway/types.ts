import type { SubscriberTier } from "@/domain/SubscriberTier";

export interface FollowerGiveawayForm {
    title: string;
    description: string;
    requiredSubscriber: SubscriberTier;
    subscriberMultiplier: Record<SubscriberTier, number>;
}
