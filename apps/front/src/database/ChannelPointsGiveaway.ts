import { openDb } from ".";

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

  const getChannelPointsGiveaways = async (): Promise<
    ChannelPointsGiveawayFormData[]
  > => {
    const db = await openDb();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, "readonly");
      const req = tx.objectStore(STORE_NAME).getAll();
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  };

  const getChannelPointsGiveaway = async (
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

  const updateChannelPointsGiveaway = async (
    data: ChannelPointsGiveawayFormData
  ) => {
    const db = await openDb();
    return new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, "readwrite");
      tx.objectStore(STORE_NAME).put(data);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  };

  const deleteChannelPointsGiveaway = async (id: string) => {
    const db = await openDb();
    return new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, "readwrite");
      tx.objectStore(STORE_NAME).delete(id);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  };

  return {
    addChannelPointsGiveaway,
    getChannelPointsGiveaways,
    getChannelPointsGiveaway,
    updateChannelPointsGiveaway,
    deleteChannelPointsGiveaway,
  };
}
