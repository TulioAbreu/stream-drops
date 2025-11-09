// Mock chat data generator
import type { ChatMessage, ChatParticipant } from "../types";
import { TwitchSubscriptionTier, SubscriptionTierWithFree, type SubscriptionTierWithFree as SubscriptionTierWithFreeType } from "@/service/twitch/types";

const mockUsernames = [
    "StreamMaster",
    "GamerPro123",
    "NightOwl",
    "TechWizard",
    "CoolCat88",
    "PixelWarrior",
    "ChillVibes",
    "EpicGamer",
    "CodeNinja",
    "MusicLover",
    "ArtisticSoul",
    "SpeedRunner",
    "RetroGamer",
    "FunnyGuy",
    "QuietObserver",
];

const mockAvatars = [
    "https://static-cdn.jtvnw.net/jtv_user_pictures/aac6fec6-f3df-4b7d-9d68-f8e7d48fce32-profile_image-70x70.png",
    "https://static-cdn.jtvnw.net/jtv_user_pictures/a14c3f4b-8f3e-4c5d-9f3a-7b8c9d0e1f2a-profile_image-70x70.png",
    "https://static-cdn.jtvnw.net/user-default-pictures-uv/ebe4cd89-b4f4-4cd9-adac-2f30151b4209-profile_image-70x70.png",
];

const mockMessages = [
    "Adorando a stream! 💜",
    "Que gameplay incrível!",
    "Muito bom!",
    "Top demais esse jogo",
    "Primeira vez aqui, adorando!",
    "Já sou fã!",
    "Melhor stream!",
    "Conteúdo de qualidade 🔥",
    "Continue assim!",
    "Show demais!",
];

export function generateMockChatMessages(count: number = 50): ChatMessage[] {
    const messages: ChatMessage[] = [];
    const now = Date.now();

    for (let i = 0; i < count; i++) {
        const username = mockUsernames[Math.floor(Math.random() * mockUsernames.length)];
        const tier = getMockTier();

        messages.push({
            id: `msg-${i}-${Date.now()}`,
            userId: `user-${Math.floor(Math.random() * 1000)}`,
            userName: username.toLowerCase(),
            displayName: username,
            avatar: mockAvatars[Math.floor(Math.random() * mockAvatars.length)],
            message: mockMessages[Math.floor(Math.random() * mockMessages.length)],
            timestamp: new Date(now - (count - i) * 5000).toISOString(),
            tier,
            subscriptionMonths: tier === SubscriptionTierWithFree.FREE ? undefined : Math.floor(Math.random() * 24) + 1,
        });
    }

    return messages;
}

function getMockTier(): SubscriptionTierWithFreeType {
    const rand = Math.random();
    if (rand < 0.4) return SubscriptionTierWithFree.FREE;
    if (rand < 0.7) return TwitchSubscriptionTier.TIER_1;
    if (rand < 0.9) return TwitchSubscriptionTier.TIER_2;
    return TwitchSubscriptionTier.TIER_3;
}

export function convertMessageToParticipant(
    message: ChatMessage,
    keyword: string
): ChatParticipant | null {
    // Check if message contains the keyword
    if (!message.message.toLowerCase().includes(keyword.toLowerCase())) {
        return null;
    }

    return {
        id: message.userId,
        name: message.userName,
        displayName: message.displayName,
        avatar: message.avatar,
        tier: message.tier,
        message: message.message,
        timestamp: message.timestamp,
    };
}

export function filterParticipantsByMinimumTier(
    participants: ChatParticipant[],
    minimumTier: SubscriptionTierWithFreeType
): ChatParticipant[] {
    if (minimumTier === SubscriptionTierWithFree.FREE) {
        return participants;
    }

    const tierOrder: Record<SubscriptionTierWithFreeType, number> = {
        [SubscriptionTierWithFree.FREE]: 0,
        [SubscriptionTierWithFree.TIER_1]: 1,
        [SubscriptionTierWithFree.TIER_2]: 2,
        [SubscriptionTierWithFree.TIER_3]: 3,
    };

    const minTierValue = tierOrder[minimumTier];

    return participants.filter(p => {
        const participantTierValue = tierOrder[p.tier];
        return participantTierValue >= minTierValue;
    });
}
