import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  closeDb,
  DATABASE_NAME,
  DATABASE_STORES,
  DATABASE_VERSION,
} from "@/database";
import {
  readLocalDatabaseBackup,
  serializeBackup,
} from "@/database/export-backup";

const PROBE_STORE = "backup-probe";
const SECRET_TOKEN = "super-secret-token-do-not-export";
const DRIVE_SECRET = "drive-code-do-not-export";
const EXPORTED_AT = "2026-10-08T12:00:00.000Z";

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
    request.onblocked = () => {
      reject(new Error("deleteDatabase bloqueado"));
    };
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
        for (const record of records) {
          objectStore.add(record);
        }
      }
    };
    request.onsuccess = () => {
      const db = request.result;
      const version = db.version;
      const created = db.objectStoreNames.contains(PROBE_STORE);
      db.close();
      if (version !== DATABASE_VERSION || !created) {
        reject(new Error("fixture do backup não foi criada"));
        return;
      }
      resolve();
    };
  });
}

interface DatabaseSnapshot {
  version: number;
  stores: Record<string, unknown[]>;
}

function snapshotDatabase(): Promise<DatabaseSnapshot> {
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

function stable(snapshot: DatabaseSnapshot) {
  const stores: Record<string, unknown[]> = {};
  for (const name of Object.keys(snapshot.stores).sort()) {
    stores[name] = snapshot.stores[name];
  }
  return { version: snapshot.version, stores };
}

describe("export de backup JSON", () => {
  beforeEach(async () => {
    await deleteDatabase();
  });

  afterEach(async () => {
    localStorage.clear();
    await deleteDatabase();
  });

  it("lê todos os stores de um DB v12 e não altera o banco nem vaza segredo", async () => {
    await createFixture();
    localStorage.setItem(
      "login-storage",
      JSON.stringify({
        state: {
          twitchAccessToken: SECRET_TOKEN,
          driveCode: DRIVE_SECRET,
        },
      }),
    );
    localStorage.setItem("twitchAccessToken", SECRET_TOKEN);

    const before = await snapshotDatabase();
    expect(before.version).toBe(12);
    expect(Object.keys(before.stores).sort()).toEqual(
      Object.keys(FIXTURE).sort(),
    );

    const backup = await readLocalDatabaseBackup({
      now: () => EXPORTED_AT,
    });
    const after = await snapshotDatabase();

    expect(stable(after)).toEqual(stable(before));
    expect(after.version).toBe(12);
    expect(backup.dbVersion).toBe(12);
    expect(Object.keys(backup)).toEqual([
      "app",
      "format",
      "dbVersion",
      "exportedAt",
      "stores",
    ]);
    expect(backup.app).toBe("stream-drops");
    expect(backup.format).toBe(1);
    expect(backup.exportedAt).toBe(EXPORTED_AT);
    expect(Object.keys(backup.stores).sort()).toEqual(
      Object.keys(before.stores).sort(),
    );

    for (const name of Object.keys(FIXTURE)) {
      expect(backup.stores[name]).toEqual(before.stores[name]);
      expect(backup.stores[name]).toHaveLength(FIXTURE[name].length);
    }
    expect(backup.stores[PROBE_STORE]).toEqual(FIXTURE[PROBE_STORE]);
    expect(backup.stores["chat-participants"]).toEqual([]);

    const file = serializeBackup(backup);
    const parsed = JSON.parse(file) as typeof backup;
    expect(parsed.stores).toEqual(backup.stores);
    expect(file).not.toContain(SECRET_TOKEN);
    expect(file).not.toContain(DRIVE_SECRET);
    expect(file).not.toContain("login-storage");
    expect(file).not.toContain("twitchAccessToken");
    expect(file).toContain("fixture-only-store");
    expect(file).toContain("nightbot");
  });
});
