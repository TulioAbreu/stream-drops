import type { BroadcasterSubscriber } from "@/service/twitch/types";

export function filterElegibleSubscribers(
    subscribers: BroadcasterSubscriber[],
    subscriberRequirement: number,
): BroadcasterSubscriber[] {
    return subscribers.filter((subscriber) => {
        const numericTier = Number(subscriber.tier);
        return numericTier >= subscriberRequirement;
    });
}