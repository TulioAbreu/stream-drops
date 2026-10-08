import {
  readLocalDatabaseBackup,
  type StreamDropsBackup,
} from "./export-backup";

export interface StoreSummary {
  name: string;
  count: number;
  bytes: number;
  winnerCount: number | null;
}

export interface LocalDatabaseSummary {
  exists: boolean;
  dbVersion: number;
  totalBytes: number;
  stores: StoreSummary[];
  giveawayCount: number;
  rouletteCount: number;
  exclusionCount: number;
}

const GIVEAWAY_STORES = new Set([
  "chat-giveaways",
  "giveaways",
  "channel-points-giveaways",
]);

const listeners = new Set<() => void>();

export function subscribeLocalDatabase(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** Avisa a UI para reler. Não grava nada. */
export function notifyLocalDatabaseChanged(): void {
  listeners.forEach((listener) => listener());
}

function countWinners(records: unknown[]): number | null {
  let found = false;
  let total = 0;
  for (const record of records) {
    if (!record || typeof record !== "object") continue;
    const winners = (record as { winners?: unknown }).winners;
    if (!Array.isArray(winners)) continue;
    found = true;
    total += winners.length;
  }
  return found ? total : null;
}

export function summarizeLocalDatabase(
  backup: StreamDropsBackup,
): LocalDatabaseSummary {
  const stores = Object.entries(backup.stores).map(([name, records]) => ({
    name,
    count: records.length,
    bytes:
      records.length === 0
        ? 0
        : new TextEncoder().encode(JSON.stringify(records)).length,
    winnerCount: countWinners(records),
  }));

  const totalBytes = stores.reduce((sum, store) => sum + store.bytes, 0);
  const countOf = (name: string) =>
    stores.find((store) => store.name === name)?.count ?? 0;

  return {
    exists: backup.dbVersion > 0,
    dbVersion: backup.dbVersion,
    totalBytes,
    stores,
    giveawayCount: stores
      .filter((store) => GIVEAWAY_STORES.has(store.name))
      .reduce((sum, store) => sum + store.count, 0),
    rouletteCount: countOf("roulettes"),
    exclusionCount: countOf("exclusion-list"),
  };
}

export async function readLocalDatabaseSummary(): Promise<LocalDatabaseSummary> {
  const backup = await readLocalDatabaseBackup();
  return summarizeLocalDatabase(backup);
}
