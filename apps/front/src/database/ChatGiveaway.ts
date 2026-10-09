import { openDb } from ".";
import type { ChatParticipant } from "@/pages/chat-giveaway/types";
import type { GiveawayParticipation } from "./giveaway-deletion";
import {
    hardDeleteChatGiveaway,
    isDeletedGiveaway,
    softDeleteChatGiveaway,
    type GiveawayWriteResult,
} from "./giveaway-deletion";

/** Copiado do participante na confirmação. Só os campos que existiam. */
export interface ChatGiveawayWinnerContext {
    subscriptionMonths?: number;
    tier?: 1000 | 2000 | 3000;
}

export interface ChatGiveawayWinner {
    id: string;
    name: string;
    twitchId: string;
    avatar: string;
    drawnAt: string;
    /** Ausente nos vencedores confirmados antes da S3. */
    context?: ChatGiveawayWinnerContext;
}

export interface ChatGiveawayFormData {
    id: string;
    title: string;
    description: string;
    keyword: string;
    cost: number;
    minimumSuscriptionTimeInMonths: number;
    subscriberMultiplier: number;
    subscribersOnly: boolean;
    winners: ChatGiveawayWinner[];
    participants?: ChatParticipant[];
    createdAt: string;
    updatedAt: string;
    /** ISO UTC. Ausente = sorteio ativo. */
    deletedAt?: string;
    /** Resumo gravado no soft-delete. Ausente nos sorteios ativos. */
    participation?: GiveawayParticipation;
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

    const readChatGiveaways = async (): Promise<ChatGiveawayFormData[]> => {
        const db = await openDb();
        return new Promise((resolve, reject) => {
            const tx = db.transaction(STORE_NAME, "readonly");
            const req = tx.objectStore(STORE_NAME).getAll();
            req.onsuccess = () => resolve(req.result ?? []);
            req.onerror = () => reject(req.error);
        });
    };

    const readChatGiveaway = async (
        id: string,
    ): Promise<ChatGiveawayFormData | undefined> => {
        const db = await openDb();
        return new Promise((resolve, reject) => {
            const tx = db.transaction(STORE_NAME, "readonly");
            const req = tx.objectStore(STORE_NAME).get(id);
            req.onsuccess = () => resolve(req.result);
            req.onerror = () => reject(req.error);
        });
    };

    // READ ALL — só ativos. Sem `deletedAt` continua ativo.
    const getChatGiveaways = async (): Promise<ChatGiveawayFormData[]> => {
        const rows = await readChatGiveaways();
        return rows.filter((row) => !isDeletedGiveaway(row));
    };

    const getChatGiveawaysIncludingDeleted = readChatGiveaways;

    // READ ONE — soft-deleted chega como não encontrado.
    const getChatGiveaway = async (
        id: string,
    ): Promise<ChatGiveawayFormData | undefined> => {
        const row = await readChatGiveaway(id);
        if (!row || isDeletedGiveaway(row)) return undefined;
        return row;
    };

    const getChatGiveawayIncludingDeleted = readChatGiveaway;

    // UPDATE — não ressuscita um soft-deleted.
    const updateChatGiveaway = async (
        data: ChatGiveawayFormData,
    ): Promise<GiveawayWriteResult> => {
        const db = await openDb();
        return new Promise((resolve, reject) => {
            const tx = db.transaction(STORE_NAME, "readwrite");
            const store = tx.objectStore(STORE_NAME);
            let result: GiveawayWriteResult = "saved";
            const request = store.get(data.id);
            request.onsuccess = () => {
                const previous = request.result as ChatGiveawayFormData | undefined;
                if (isDeletedGiveaway(previous)) {
                    result = "deleted";
                    return;
                }
                store.put(data);
            };
            tx.oncomplete = () => resolve(result);
            tx.onerror = () => reject(tx.error);
            tx.onabort = () => reject(tx.error);
        });
    };

    return {
        addChatGiveaway,
        getChatGiveaways,
        getChatGiveawaysIncludingDeleted,
        getChatGiveaway,
        getChatGiveawayIncludingDeleted,
        updateChatGiveaway,
        deleteChatGiveaway: hardDeleteChatGiveaway,
        softDeleteChatGiveaway,
    };
}
