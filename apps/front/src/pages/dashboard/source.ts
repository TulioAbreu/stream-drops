import { databaseExists, openExistingDatabase } from "@/database/open-existing-database";

/**
 * Leitura do histórico para a Dashboard.
 * Não cria banco, não dá bump e não abre transação de escrita.
 * Banco ausente vira fonte vazia.
 */

export type DashboardSource = {
  chat: unknown[];
  channelPoints: unknown[];
  subscribers: unknown[];
  excludedUserIds: string[];
};

const STORE_CHAT = "chat-giveaways";
const STORE_POINTS = "channel-points-giveaways";
const STORE_SUBS = "giveaways";
const STORE_EXCLUSION = "exclusion-list";

const EMPTY_SOURCE: DashboardSource = {
  chat: [],
  channelPoints: [],
  subscribers: [],
  excludedUserIds: [],
};

function readStores(
  db: IDBDatabase,
  names: readonly string[],
): Promise<unknown[][]> {
  if (names.length === 0) return Promise.resolve([]);
  return new Promise((resolve, reject) => {
    const tx = db.transaction([...names], "readonly");
    const rows: unknown[][] = names.map(() => []);
    names.forEach((name, index) => {
      const request = tx.objectStore(name).getAll();
      request.onsuccess = () => {
        rows[index] = Array.isArray(request.result) ? request.result : [];
      };
    });
    tx.oncomplete = () => resolve(rows);
    tx.onerror = () => reject(tx.error ?? new Error("Falha ao ler a Dashboard"));
    tx.onabort = () => reject(tx.error ?? new Error("Leitura da Dashboard abortada"));
  });
}

function excludedIds(rows: unknown[]): string[] {
  const ids: string[] = [];
  for (const item of rows) {
    if (!item || typeof item !== "object") continue;
    const id = (item as { twitchUserId?: unknown }).twitchUserId;
    if (typeof id === "string" && id.length > 0) ids.push(id);
  }
  return ids;
}

export async function readDashboardSource(): Promise<DashboardSource> {
  const exists = await databaseExists();
  if (!exists) return { ...EMPTY_SOURCE };
  const db = await openExistingDatabase();
  try {
    const wanted = [STORE_CHAT, STORE_POINTS, STORE_SUBS, STORE_EXCLUSION].filter(
      (name) => db.objectStoreNames.contains(name),
    );
    const rows = await readStores(db, wanted);
    const byName = new Map<string, unknown[]>();
    wanted.forEach((name, index) => {
      byName.set(name, rows[index] ?? []);
    });
    return {
      chat: byName.get(STORE_CHAT) ?? [],
      channelPoints: byName.get(STORE_POINTS) ?? [],
      subscribers: byName.get(STORE_SUBS) ?? [],
      excludedUserIds: excludedIds(byName.get(STORE_EXCLUSION) ?? []),
    };
  } finally {
    db.close();
  }
}
