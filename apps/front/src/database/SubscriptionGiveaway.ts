import type { BroadcasterSubscriber, TwitchSubscriptionTier } from "@/service/twitch/types";
import { openDb } from ".";
import {
    hardDeleteSubscriberGiveaway,
    isDeletedGiveaway,
    softDeleteSubscriberGiveaway,
    type GiveawayWriteResult,
} from "./giveaway-deletion";

/** Vencedor de Subscribers. `drawnAt` só existe em quem entrou a partir da S3. */
export type SubscriberGiveawayWinner = BroadcasterSubscriber & {
    drawnAt?: string;
};

export interface FollowerGiveawayFormData {
    id: string;
    title: string;
    description: string;
    subscriptionRequirement: number;
    subscriberMultiplier: Record<TwitchSubscriptionTier, number>;
    participants: BroadcasterSubscriber[];
    winners: SubscriberGiveawayWinner[];
    spreadsheetUrl: string | null;
    /** ISO UTC. Ausente nos sorteios gravados antes da S3. */
    createdAt?: string;
    /** ISO UTC. Ausente nos sorteios gravados antes da S3. */
    updatedAt?: string;
    /** ISO UTC. Ausente = sorteio ativo. Sem resumo `participation`. */
    deletedAt?: string;
}

function hasDrawnAt(winner: SubscriberGiveawayWinner): boolean {
    return typeof winner.drawnAt === "string"
        && winner.drawnAt.length > 0
        && Number.isFinite(Date.parse(winner.drawnAt));
}

/**
 * Grava o que a tela já mandou.
 * Vencedor que já estava no registro volta igual, sem `drawnAt` inventado.
 * Quem entra agora ganha `drawnAt` se ainda não tiver.
 * `createdAt`/`updatedAt` só continuam em sorteio que já os tem.
 */
export function mergeSubscriberGiveawayUpdate(
    previous: FollowerGiveawayFormData | undefined,
    incoming: FollowerGiveawayFormData,
    now: string,
): FollowerGiveawayFormData {
    const previousWinners = new Map(
        (previous?.winners ?? []).map((winner) => [winner.user_id, winner]),
    );
    const winners = incoming.winners.map((winner) => {
        const prior = previousWinners.get(winner.user_id);
        if (prior) return prior;
        if (hasDrawnAt(winner)) return winner;
        return { ...winner, drawnAt: now };
    });

    const next: FollowerGiveawayFormData = { ...incoming, winners };
    const createdAt = previous?.createdAt ?? incoming.createdAt;
    const hadTimestamps = createdAt !== undefined
        || previous?.updatedAt !== undefined
        || incoming.updatedAt !== undefined;

    if (!hadTimestamps) {
        delete next.createdAt;
        delete next.updatedAt;
        return next;
    }

    if (createdAt !== undefined) next.createdAt = createdAt;
    else delete next.createdAt;
    next.updatedAt = now;
    return next;
}

const STORE_NAME = "giveaways";

export function useSubscriptionGiveawayDb() {
    // CREATE
    const addGiveaway = async (data: FollowerGiveawayFormData) => {
        const db = await openDb();
        const now = new Date().toISOString();
        const record: FollowerGiveawayFormData = {
            ...data,
            createdAt: data.createdAt ?? now,
            updatedAt: data.updatedAt ?? now,
        };
        return new Promise<void>((resolve, reject) => {
            const tx = db.transaction(STORE_NAME, "readwrite");
            tx.objectStore(STORE_NAME).add(record);
            tx.oncomplete = () => resolve();
            tx.onerror = () => reject(tx.error);
        });
    };

    const readGiveaways = async (): Promise<FollowerGiveawayFormData[]> => {
        const db = await openDb();
        return new Promise((resolve, reject) => {
            const tx = db.transaction(STORE_NAME, "readonly");
            const req = tx.objectStore(STORE_NAME).getAll();
            req.onsuccess = () => resolve(req.result ?? []);
            req.onerror = () => reject(req.error);
        });
    };

    const readGiveaway = async (
        id: string,
    ): Promise<FollowerGiveawayFormData | undefined> => {
        const db = await openDb();
        return new Promise((resolve, reject) => {
            const tx = db.transaction(STORE_NAME, "readonly");
            const req = tx.objectStore(STORE_NAME).get(id);
            req.onsuccess = () => resolve(req.result);
            req.onerror = () => reject(req.error);
        });
    };

    // READ ALL — só ativos. Sem `deletedAt` continua ativo.
    const getGiveaways = async (): Promise<FollowerGiveawayFormData[]> => {
        const rows = await readGiveaways();
        return rows.filter((row) => !isDeletedGiveaway(row));
    };

    const getGiveawaysIncludingDeleted = readGiveaways;

    // READ ONE — soft-deleted chega como não encontrado.
    const getGiveaway = async (
        id: string,
    ): Promise<FollowerGiveawayFormData | undefined> => {
        const row = await readGiveaway(id);
        if (!row || isDeletedGiveaway(row)) return undefined;
        return row;
    };

    const getGiveawayIncludingDeleted = readGiveaway;

    // UPDATE
    const updateGiveaway = async (
        data: FollowerGiveawayFormData,
    ): Promise<GiveawayWriteResult> => {
        const db = await openDb();
        const now = new Date().toISOString();
        return new Promise((resolve, reject) => {
            const tx = db.transaction(STORE_NAME, "readwrite");
            const store = tx.objectStore(STORE_NAME);
            let result: GiveawayWriteResult = "saved";
            const request = store.get(data.id);
            request.onsuccess = () => {
                const previous = request.result as FollowerGiveawayFormData | undefined;
                if (isDeletedGiveaway(previous)) {
                    result = "deleted";
                    return;
                }
                store.put(mergeSubscriberGiveawayUpdate(previous, data, now));
            };
            tx.oncomplete = () => resolve(result);
            tx.onerror = () => reject(tx.error);
            tx.onabort = () => reject(tx.error);
        });
    };

    return {
        addGiveaway,
        getGiveaways,
        getGiveawaysIncludingDeleted,
        getGiveaway,
        getGiveawayIncludingDeleted,
        updateGiveaway,
        deleteGiveaway: hardDeleteSubscriberGiveaway,
        softDeleteGiveaway: softDeleteSubscriberGiveaway,
    };
}
