import { openDb } from ".";
import type { GiveawayParticipation } from "./giveaway-deletion";
import {
  hardDeleteChannelPointsGiveaway,
  isDeletedGiveaway,
  softDeleteChannelPointsGiveaway,
  type GiveawayWriteResult,
} from "./giveaway-deletion";

export type ChannelPointsGiveawayStatus =
  | "open"
  | "collecting"
  | "ready"
  | "closed";

export interface ChannelPointsRedemptionTicket {
  redemptionId: string;
  redeemedAt: string;
}

export interface ChannelPointsParticipant {
  userId: string;
  name: string;
  displayName: string;
  avatar: string;
  subscriber: boolean;
  tier?: 1000 | 2000 | 3000 | null;
  tickets: ChannelPointsRedemptionTicket[];
}

export interface ChannelPointsWinner {
  id: string;
  userId: string;
  name: string;
  avatar: string;
  redemptionId: string;
  drawnAt: string;
}

export interface ChannelPointsGiveawayFormData {
  id: string;
  title: string;
  description: string;
  cost: number;
  rewardId: string | null;
  /** Mirrors Twitch custom reward `is_enabled`. Absent on legacy rows → treat as true. */
  rewardEnabled?: boolean;
  /** null = Twitch max_per_stream disabled */
  maxPerStream: number | null;
  subscribersOnly: boolean;
  subscriptionRequirement: number;
  /** Luck weight per sub tier. Each redemption still yields at most one win. */
  subscriberMultiplier: Record<"1000" | "2000" | "3000", number>;
  refundIneligible: boolean;
  allowMultipleWins: boolean;
  status: ChannelPointsGiveawayStatus;
  participants: ChannelPointsParticipant[];
  winners: ChannelPointsWinner[];
  collectionProgress?: { loaded: number; page: number };
  createdAt: string;
  updatedAt: string;
  /** ISO UTC. Ausente = sorteio ativo. */
  deletedAt?: string;
  /** Resumo gravado no soft-delete. Ausente nos sorteios ativos. */
  participation?: GiveawayParticipation;
}

const STORE_NAME = "channel-points-giveaways";

export function useChannelPointsGiveawayDb() {
  const addChannelPointsGiveaway = async (
    data: ChannelPointsGiveawayFormData
  ) => {
    const db = await openDb();
    return new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, "readwrite");
      tx.objectStore(STORE_NAME).add(data);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  };

  const readChannelPointsGiveaways = async (): Promise<
    ChannelPointsGiveawayFormData[]
  > => {
    const db = await openDb();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, "readonly");
      const req = tx.objectStore(STORE_NAME).getAll();
      req.onsuccess = () => resolve(req.result ?? []);
      req.onerror = () => reject(req.error);
    });
  };

  const readChannelPointsGiveaway = async (
    id: string
  ): Promise<ChannelPointsGiveawayFormData | undefined> => {
    const db = await openDb();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, "readonly");
      const req = tx.objectStore(STORE_NAME).get(id);
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  };

  const getChannelPointsGiveaways = async (): Promise<
    ChannelPointsGiveawayFormData[]
  > => {
    const rows = await readChannelPointsGiveaways();
    return rows.filter((row) => !isDeletedGiveaway(row));
  };

  const getChannelPointsGiveawaysIncludingDeleted = readChannelPointsGiveaways;

  const getChannelPointsGiveaway = async (
    id: string
  ): Promise<ChannelPointsGiveawayFormData | undefined> => {
    const row = await readChannelPointsGiveaway(id);
    if (!row || isDeletedGiveaway(row)) return undefined;
    return row;
  };

  const getChannelPointsGiveawayIncludingDeleted = readChannelPointsGiveaway;

  const updateChannelPointsGiveaway = async (
    data: ChannelPointsGiveawayFormData
  ): Promise<GiveawayWriteResult> => {
    const db = await openDb();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, "readwrite");
      const store = tx.objectStore(STORE_NAME);
      let result: GiveawayWriteResult = "saved";
      const request = store.get(data.id);
      request.onsuccess = () => {
        const previous = request.result as
          | ChannelPointsGiveawayFormData
          | undefined;
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
    addChannelPointsGiveaway,
    getChannelPointsGiveaways,
    getChannelPointsGiveawaysIncludingDeleted,
    getChannelPointsGiveaway,
    getChannelPointsGiveawayIncludingDeleted,
    updateChannelPointsGiveaway,
    deleteChannelPointsGiveaway: hardDeleteChannelPointsGiveaway,
    softDeleteChannelPointsGiveaway,
  };
}
