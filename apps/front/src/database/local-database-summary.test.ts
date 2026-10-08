import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  closeDb,
  DATABASE_NAME,
  DATABASE_STORES,
  DATABASE_VERSION,
} from "@/database";
import { readLocalDatabaseSummary } from "@/database/local-database-summary";

const PROBE_STORE = "summary-probe";

const FIXTURE: Record<string, Record<string, unknown>[]> = {
  "exclusion-list": [
    {
      twitchUserId: "100",
      username: "nightbot",
      displayName: "Nightbot",
      profileImageUrl: "",
      updatedAt: "2026-01-01T00:00:00.000Z",
    },
    {
      twitchUserId: "200",
      username: "fossabot",
      displayName: "Fossabot",
      profileImageUrl: "",
      updatedAt: "2026-01-02T00:00:00.000Z",
    },
  ],
  giveaways: [
    { id: "giveaway-1", title: "Outubro", winners: [{ id: "w1" }] },
  ],
  "chat-giveaways": [
    {
      id: "chat-1",
      title: "Live 42",
      winners: [{ id: "a" }, { id: "b" }],
    },
    { id: "chat-2", title: "Live 41", winners: [] },
  ],
  "chat-giveaway-templates": [{ id: "template-1", name: "Padrão" }],
  "chat-participants": [],
  roulettes: [{ id: "roulette-1", title: "Prêmios" }],
  "channel-points-giveaways": [
    { id: "points-1", title: "Skin", winners: [{ id: "p1" }] },
  ],
  [PROBE_STORE]: [{ id: "probe-1", marker: "fixture-only-store" }],
};

function deleteDatabase(): Promise<void> {
  closeDb();
  return new Promise((resolve, reject) => {
    const request = indexedDB.deleteDatabase(DATABASE_NAME);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
    request.onblocked = () => reject(new Error("deleteDatabase bloqueado"));
  });
}

function createFixture(): Promise<void> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DATABASE_NAME, DATABASE_VERSION);
    request.onerror = () => reject(request.error);
    request.onupgradeneeded = () => {
      const db = request.result;
      for (const store of DATABASE_STORES) {
        if (db.objectStoreNames.contains(store.name)) continue;
        const objectStore = db.createObjectStore(
          store.name,
          store.primaryKey.options,
        );
        store.indexes?.forEach((index) => {
          objectStore.createIndex(index.name, index.keyPath, index.options);
        });
      }
      if (!db.objectStoreNames.contains(PROBE_STORE)) {
        db.createObjectStore(PROBE_STORE, { keyPath: "id" });
      }
      const tx = request.transaction;
      if (!tx) {
        reject(new Error("transação de upgrade ausente"));
        return;
      }
      for (const [name, records] of Object.entries(FIXTURE)) {
        const objectStore = tx.objectStore(name);
        for (const record of records) objectStore.add(record);
      }
    };
    request.onsuccess = () => {
      const db = request.result;
      const created = db.objectStoreNames.contains(PROBE_STORE);
      db.close();
      if (!created) {
        reject(new Error("fixture do baú não foi criada"));
        return;
      }
      resolve();
    };
  });
}

function snapshotDatabase(): Promise<{
  version: number;
  stores: Record<string, unknown[]>;
}> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DATABASE_NAME);
    request.onerror = () => reject(request.error);
    request.onsuccess = () => {
      const db = request.result;
      const names = Array.from(db.objectStoreNames);
      const tx = db.transaction(names, "readonly");
      const stores: Record<string, unknown[]> = {};
      tx.oncomplete = () => {
        const version = db.version;
        db.close();
        resolve({ version, stores });
      };
      tx.onerror = () => {
        db.close();
        reject(tx.error);
      };
      for (const name of names) {
        const getAll = tx.objectStore(name).getAll();
        getAll.onsuccess = () => {
          stores[name] = getAll.result as unknown[];
        };
        getAll.onerror = () => reject(getAll.error);
      }
    };
  });
}

describe("baú deste navegador", () => {
  beforeEach(async () => {
    await deleteDatabase();
  });

  afterEach(async () => {
    await deleteDatabase();
  });

  it("conta os stores sem getAll nem serializar os registros", async () => {
    await createFixture();
    const before = await snapshotDatabase();

    const originalGetAll = IDBObjectStore.prototype.getAll;
    const originalStringify = JSON.stringify;
    let getAllCalls = 0;
    IDBObjectStore.prototype.getAll = function getAllBlocked() {
      getAllCalls += 1;
      throw new Error("getAll não deve rodar no baú");
    };
    JSON.stringify = ((value: unknown, ...rest: unknown[]) => {
      const serialized = originalStringify(value);
      if (
        serialized.includes("Nightbot") ||
        serialized.includes("Live 42")
      ) {
        throw new Error("o baú serializou os registros");
      }
      return originalStringify(value, ...(rest as [never, never]));
    }) as typeof JSON.stringify;

    let summary: Awaited<ReturnType<typeof readLocalDatabaseSummary>>;
    try {
      summary = await readLocalDatabaseSummary();
    } finally {
      IDBObjectStore.prototype.getAll = originalGetAll;
      JSON.stringify = originalStringify;
    }

    expect(getAllCalls).toBe(0);
    expect(summary.dbVersion).toBe(12);
    expect(summary.exists).toBe(true);
    expect(summary.giveawayCount).toBe(4);
    expect(summary.rouletteCount).toBe(1);
    expect(summary.exclusionCount).toBe(2);
    expect(
      summary.estimatedBytes === null ||
        typeof summary.estimatedBytes === "number",
    ).toBe(true);

    const counts = Object.fromEntries(
      summary.stores.map((store) => [store.name, store.count]),
    );
    expect(counts).toEqual({
      "exclusion-list": 2,
      giveaways: 1,
      "chat-giveaways": 2,
      "chat-giveaway-templates": 1,
      "chat-participants": 0,
      roulettes: 1,
      "channel-points-giveaways": 1,
      [PROBE_STORE]: 1,
    });
    for (const store of summary.stores) {
      expect(Object.keys(store).sort()).toEqual(["count", "name"]);
    }
    expect(JSON.stringify(summary)).not.toContain("Nightbot");
    expect(JSON.stringify(summary)).not.toContain("Live 42");

    const after = await snapshotDatabase();
    expect(after.version).toBe(12);
    expect(after).toEqual(before);
  });

  it("não cria o banco quando ele ainda não existe", async () => {
    await deleteDatabase();
    const summary = await readLocalDatabaseSummary();
    expect(summary.exists).toBe(false);
    expect(summary.dbVersion).toBe(0);
    expect(summary.stores).toEqual([]);
    const databases = await indexedDB.databases();
    expect(databases.some((database) => database.name === DATABASE_NAME)).toBe(
      false,
    );
  });
});
