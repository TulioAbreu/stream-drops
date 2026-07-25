import type tmi from "tmi.js";
import type { ChatMessage, ChatParticipant } from "../../types";

export interface GiveawayConfig {
    keyword: string;
    minimumSuscriptionTimeInMonths: number;
    subscribersOnly: boolean;
}

export function parseBadgeRaw(badgeInfoRaw: string) {
    const badgeInfo: Record<string, string> = {};

    const rawBadges = badgeInfoRaw.split(",");
    for (const badge of rawBadges) {
        const [key, value] = badge.split("/");
        if (key && value) {
            badgeInfo[key] = value;
        }
    }
    return badgeInfo;
}

export function parseSubscriptionMonths(badgeInfo: Record<string, string>, userstateBadgeInfo?: Record<string, string | undefined>): number | undefined {
    const rawSubscriptionMonths = badgeInfo["founder"] ?? userstateBadgeInfo?.subscriber;
    if (!rawSubscriptionMonths) {
        return undefined;
    }
    
    const parsed = parseInt(rawSubscriptionMonths, 10);
    if (isNaN(parsed)) {
        return undefined;
    }
    
    return parsed;
}

export function convertTmiMessage(userstate: tmi.ChatUserstate, message: string): ChatMessage {
    console.log("Userstate:", userstate);

    const badgeInfo = parseBadgeRaw(userstate["badge-info-raw"] ?? "");
    const subscriptionMonths = parseSubscriptionMonths(badgeInfo, userstate["badge-info"] as Record<string, string | undefined> | undefined);

    return {
        id: `${userstate.id || Date.now()}-${Math.random()}`,
        userId: userstate["user-id"] || "unknown",
        userName: userstate.username || "unknown",
        displayName: userstate["display-name"] || userstate.username || "Unknown",
        avatar: `https://static-cdn.jtvnw.net/user-default-pictures-uv/ebe4cd89-b4f4-4cd9-adac-2f30151b4209-profile_image-70x70.png`,
        message: message,
        timestamp: new Date().toISOString(),
        subscriber: userstate.subscriber || false,
        subscriptionMonths: subscriptionMonths,
    };
}

export function convertMessageToParticipant(
    chatMessage: ChatMessage,
    config: GiveawayConfig
): ChatParticipant | null {
    // Check if message contains the keyword
    if (config.keyword.length > 0 && !chatMessage.message.toLowerCase().includes(config.keyword.toLowerCase())) {
        return null;
    }

    // Check if subscribersOnly is enabled and user is not a subscriber
    if (config.subscribersOnly && !chatMessage.subscriber) {
        return null;
    }

    // Check if user meets minimum subscription time requirement
    if (config.minimumSuscriptionTimeInMonths > 0) {
        // If subscription months is undefined or less than minimum, exclude
        if (!chatMessage.subscriptionMonths || chatMessage.subscriptionMonths < config.minimumSuscriptionTimeInMonths) {
            return null;
        }
    }

    return {
        id: chatMessage.userId,
        name: chatMessage.userName,
        displayName: chatMessage.displayName,
        subscriber: chatMessage.subscriber,
        subscriptionMonths: chatMessage.subscriptionMonths,
        avatar: chatMessage.avatar,
        joinedAt: Date.now(),
    };
}
