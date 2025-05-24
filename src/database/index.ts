import type { BroadcasterSubscriber, TwitchSubscriptionTier } from "@/service/twitch/types";

export interface FollowerGiveawayFormData {
    id: string;
    title: string;
    description: string;
    subscriptionRequirement: number;
    subscriberMultiplier: Record<TwitchSubscriptionTier, number>;
    participants: BroadcasterSubscriber[];
    winners: BroadcasterSubscriber[];
    spreadsheetUrl: string | null;
}

const DB_NAME = "stream-drops-db";
const STORE_NAME = "giveaways";
const DB_VERSION = 1;

function openDb(): Promise<IDBDatabase> {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open(DB_NAME, DB_VERSION);
        request.onupgradeneeded = () => {
            const db = request.result;
            if (!db.objectStoreNames.contains(STORE_NAME)) {
                const store = db.createObjectStore(STORE_NAME, { keyPath: "id" });
                store.createIndex("id", "id", { unique: true });
            }
        };
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
    });
}

export function useSubscriptionGiveawayDb() {
    // CREATE
    const addGiveaway = async (data: FollowerGiveawayFormData) => {
        const db = await openDb();
        return new Promise<void>((resolve, reject) => {
            const tx = db.transaction(STORE_NAME, "readwrite");
            tx.objectStore(STORE_NAME).add(data);
            tx.oncomplete = () => resolve();
            tx.onerror = () => reject(tx.error);
        });
    };

    // READ ALL
    const getGiveaways = async (): Promise<FollowerGiveawayFormData[]> => {
        const db = await openDb();
        return new Promise((resolve, reject) => {
            const tx = db.transaction(STORE_NAME, "readonly");
            const req = tx.objectStore(STORE_NAME).getAll();
            req.onsuccess = () => resolve(req.result);
            req.onerror = () => reject(req.error);
        });
    };

    // READ ONE
    const getGiveaway = async (id: string): Promise<FollowerGiveawayFormData | undefined> => {
        const db = await openDb();
        return new Promise((resolve, reject) => {
            const tx = db.transaction(STORE_NAME, "readonly");
            const req = tx.objectStore(STORE_NAME).get(id);
            req.onsuccess = () => resolve(req.result);
            req.onerror = () => reject(req.error);
        });
    };

    // UPDATE
    const updateGiveaway = async (data: FollowerGiveawayFormData) => {
        const db = await openDb();
        return new Promise<void>((resolve, reject) => {
            const tx = db.transaction(STORE_NAME, "readwrite");
            tx.objectStore(STORE_NAME).put(data);
            tx.oncomplete = () => resolve();
            tx.onerror = () => reject(tx.error);
        });
    };

    // DELETE
    const deleteGiveaway = async (id: string) => {
        const db = await openDb();
        return new Promise<void>((resolve, reject) => {
            const tx = db.transaction(STORE_NAME, "readwrite");
            tx.objectStore(STORE_NAME).delete(id);
            tx.oncomplete = () => resolve();
            tx.onerror = () => reject(tx.error);
        });
    };

    return {
        addGiveaway,
        getGiveaways,
        getGiveaway,
        updateGiveaway,
        deleteGiveaway,
    };
}