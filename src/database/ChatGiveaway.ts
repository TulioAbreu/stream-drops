import type { TwitchSubscriptionTier, SubscriptionTierWithFree } from "@/service/twitch/types";
import { openDb } from ".";

export interface ChatGiveawayWinner {
    id: string;
    name: string;
    twitchId: string;
    avatar: string;
    drawnAt: string;
}

export interface ChatGiveawayFormData {
    id: string;
    title: string;
    description: string;
    keyword: string;
    cost: number;
    minimumTier: SubscriptionTierWithFree;
    subscriberMultiplier: Record<TwitchSubscriptionTier, number>;
    winners: ChatGiveawayWinner[];
    createdAt: string;
    updatedAt: string;
}

const STORE_NAME = "chat-giveaways";

export function useChatGiveawayDb() {
    // CREATE
    const addChatGiveaway = async (data: ChatGiveawayFormData) => {
        const db = await openDb();
        return new Promise<void>((resolve, reject) => {
            const tx = db.transaction(STORE_NAME, "readwrite");
            tx.objectStore(STORE_NAME).add(data);
            tx.oncomplete = () => resolve();
            tx.onerror = () => reject(tx.error);
        });
    };

    // READ ALL
    const getChatGiveaways = async (): Promise<ChatGiveawayFormData[]> => {
        const db = await openDb();
        return new Promise((resolve, reject) => {
            const tx = db.transaction(STORE_NAME, "readonly");
            const req = tx.objectStore(STORE_NAME).getAll();
            req.onsuccess = () => resolve(req.result);
            req.onerror = () => reject(req.error);
        });
    };

    // READ ONE
    const getChatGiveaway = async (id: string): Promise<ChatGiveawayFormData | undefined> => {
        const db = await openDb();
        return new Promise((resolve, reject) => {
            const tx = db.transaction(STORE_NAME, "readonly");
            const req = tx.objectStore(STORE_NAME).get(id);
            req.onsuccess = () => resolve(req.result);
            req.onerror = () => reject(req.error);
        });
    };

    // UPDATE
    const updateChatGiveaway = async (data: ChatGiveawayFormData) => {
        const db = await openDb();
        return new Promise<void>((resolve, reject) => {
            const tx = db.transaction(STORE_NAME, "readwrite");
            tx.objectStore(STORE_NAME).put(data);
            tx.oncomplete = () => resolve();
            tx.onerror = () => reject(tx.error);
        });
    };

    // DELETE
    const deleteChatGiveaway = async (id: string) => {
        const db = await openDb();
        return new Promise<void>((resolve, reject) => {
            const tx = db.transaction(STORE_NAME, "readwrite");
            tx.objectStore(STORE_NAME).delete(id);
            tx.oncomplete = () => resolve();
            tx.onerror = () => reject(tx.error);
        });
    };

    return {
        addChatGiveaway,
        getChatGiveaways,
        getChatGiveaway,
        updateChatGiveaway,
        deleteChatGiveaway,
    };
}
