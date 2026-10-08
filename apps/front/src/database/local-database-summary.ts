import { databaseExists, openExistingDatabase } from "./open-existing-database";

export interface StoreSummary {
  name: string;
  count: number;
}

export interface LocalDatabaseSummary {
  exists: boolean;
  dbVersion: number;
  /**
   * `navigator.storage.estimate().usage` da origem.
   * Não é o tamanho serializado dos stores.
   */
  estimatedBytes: number | null;
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

function emptySummary(estimatedBytes: number | null): LocalDatabaseSummary {
  return {
    exists: false,
    dbVersion: 0,
    estimatedBytes,
    stores: [],
    giveawayCount: 0,
    rouletteCount: 0,
    exclusionCount: 0,
  };
}

async function estimateOriginBytes(): Promise<number | null> {
  if (!navigator.storage?.estimate) return null;
  try {
    const estimate = await navigator.storage.estimate();
    return typeof estimate.usage === "number" ? estimate.usage : null;
  } catch {
    return null;
  }
}

/** `count()` por store. Não chama `getAll` nem serializa registros. */
function countStores(db: IDBDatabase): Promise<StoreSummary[]> {
  const names = Array.from(db.objectStoreNames);
  if (names.length === 0) return Promise.resolve([]);

  return new Promise((resolve, reject) => {
    const tx = db.transaction(names, "readonly");
    const stores: StoreSummary[] = names.map((name) => ({ name, count: 0 }));
    const byName = new Map(stores.map((store) => [store.name, store]));

    tx.oncomplete = () => resolve(stores);
    tx.onerror = () => reject(tx.error);
    tx.onabort = () =>
      reject(tx.error ?? new Error("Contagem do baú abortada"));

    for (const name of names) {
      const request = tx.objectStore(name).count();
      request.onsuccess = () => {
        const store = byName.get(name);
        if (store) store.count = request.result;
      };
      request.onerror = () => reject(request.error);
    }
  });
}

function assemble(
  dbVersion: number,
  stores: StoreSummary[],
  estimatedBytes: number | null,
): LocalDatabaseSummary {
  const countOf = (name: string) =>
    stores.find((store) => store.name === name)?.count ?? 0;

  return {
    exists: dbVersion > 0,
    dbVersion,
    estimatedBytes,
    stores,
    giveawayCount: stores
      .filter((store) => GIVEAWAY_STORES.has(store.name))
      .reduce((sum, store) => sum + store.count, 0),
    rouletteCount: countOf("roulettes"),
    exclusionCount: countOf("exclusion-list"),
  };
}

export async function readLocalDatabaseSummary(): Promise<LocalDatabaseSummary> {
  const estimatedBytes = await estimateOriginBytes();

  if (!(await databaseExists())) {
    return emptySummary(estimatedBytes);
  }

  const db = await openExistingDatabase();
  try {
    const stores = await countStores(db);
    return assemble(db.version, stores, estimatedBytes);
  } finally {
    db.close();
  }
}
