import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { clearDatabase, openDb } from ".";
import { useChannelPointsGiveawayDb } from "./ChannelPointsGiveaway";
import {
  useChatGiveawayDb,
  type ChatGiveawayFormData,
  type ChatGiveawayWinner,
} from "./ChatGiveaway";
import { useChatGiveawayTemplateDb } from "./ChatGiveawayTemplate";
import { useExclusionListDb } from "./ExclusionListItem";
import { useRouletteDb } from "./Roulette";
import { useSubscriptionGiveawayDb } from "./SubscriptionGiveaway";
import {
  addChatParticipantRows,
  getChatParticipantsByGiveaway,
  toChatParticipantRecord,
  type ChatParticipantRecord,
} from "./chat-participants";
import type { ChatParticipant } from "@/pages/chat-giveaway/types";

/* eslint-disable react-hooks/rules-of-hooks */
const { addChatGiveaway, getChatGiveaway, updateChatGiveaway } = useChatGiveawayDb();
const { addExclusion } = useExclusionListDb();
const { addGiveaway } = useSubscriptionGiveawayDb();
const { addChannelPointsGiveaway } = useChannelPointsGiveawayDb();
const { addRoulette } = useRouletteDb();
const { addTemplate } = useChatGiveawayTemplateDb();
/* eslint-enable react-hooks/rules-of-hooks */

const DB_NAME = "stream-drops-db";

function participant(id: string, joinedAt: number): ChatParticipant {
  return {
    id,
    name: id,
    displayName: `Nome ${id}`,
    avatar: `https://example.com/${id}.png`,
    subscriber: id.endsWith("sub"),
    subscriptionMonths: id.endsWith("sub") ? 6 : undefined,
    tier: id.endsWith("sub") ? 2000 : undefined,
    joinedAt,
  };
}

function record(
  giveawayId: string,
  userId: string,
  joinedAt: number,
): ChatParticipantRecord {
  const row = toChatParticipantRecord(giveawayId, participant(userId, joinedAt));
  if (!row) {
    throw new Error("fixture inválida");
  }
  return row;
}

function winner(id: string): ChatGiveawayWinner {
  return {
    id,
    name: `Vencedor ${id}`,
    twitchId: id,
    avatar: `https://example.com/${id}.png`,
    drawnAt: "2026-03-01T12:00:00.000Z",
  };
}

function chatGiveaway(id: string): ChatGiveawayFormData {
  return {
    id,
    title: `Sorteio ${id}`,
    description: "descrição salva",
    keyword: "!join",
    cost: 0,
    minimumSuscriptionTimeInMonths: 0,
    subscriberMultiplier: 2,
    subscribersOnly: false,
    winners: [winner("winner-a")],
    participants: [participant("saved-viewer", 50)],
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-02T00:00:00.000Z",
  };
}

async function rawGetAll(storeName: string): Promise<unknown[]> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, "readonly");
    const request = tx.objectStore(storeName).getAll();
    request.onsuccess = () => resolve(request.result as unknown[]);
    request.onerror = () => reject(request.error);
  });
}

function storageFingerprint() {
  return {
    local: Object.keys(localStorage).sort(),
    session: Object.keys(sessionStorage).sort(),
    cookie: document.cookie,
  };
}

describe("chat-participants", () => {
  beforeEach(async () => {
    await clearDatabase();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("CA-D3: o primeiro joinedAt vale em outro lote e em outra conexão", async () => {
    const original = record("g-d3", "viewer", 1_111);
    const again = {
      ...original,
      displayName: "Nome novo",
      avatar: "https://example.com/novo.png",
      joinedAt: 9_999,
    };

    const first = await addChatParticipantRows([original]);
    expect(first).toEqual({ durableUserIds: ["viewer"], retry: false });

    const second = await addChatParticipantRows([again, record("g-d3", "nova", 2_222)]);
    expect(second.retry).toBe(false);
    expect(second.durableUserIds.sort()).toEqual(["nova", "viewer"]);

    const rows = await getChatParticipantsByGiveaway("g-d3");
    expect(rows).toHaveLength(2);
    expect(rows.find((row) => row.userId === "viewer")).toEqual(original);
    expect(rows.find((row) => row.userId === "nova")?.joinedAt).toBe(2_222);

    const otherDb = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open(DB_NAME);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });

    try {
      await new Promise<void>((resolve, reject) => {
        const tx = otherDb.transaction("chat-participants", "readwrite");
        const request = tx.objectStore("chat-participants").add({
          ...original,
          joinedAt: 8_888,
          displayName: "Outra aba",
        });
        request.onerror = (event) => {
          if (request.error?.name === "ConstraintError") {
            event.preventDefault();
            event.stopPropagation();
          }
        };
        tx.oncomplete = () => resolve();
        tx.onabort = () => reject(tx.error ?? new Error("abort"));
        tx.onerror = (event) => {
          if (tx.error?.name === "ConstraintError") {
            event.preventDefault();
          }
        };
      });
    } finally {
      otherDb.close();
    }

    const afterOtherConnection = (await rawGetAll("chat-participants")) as ChatParticipantRecord[];
    expect(afterOtherConnection.find((row) => row.id === original.id)).toEqual(original);
  });

  it("CA-D5: add com cota não grava e o mesmo lote entra na tentativa seguinte", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const originalAdd = IDBObjectStore.prototype.add;
    IDBObjectStore.prototype.add = function (
      this: IDBObjectStore,
      ...args: Parameters<IDBObjectStore["add"]>
    ) {
      if (this.name === "chat-participants") {
        throw new DOMException(
          "The quota has been exceeded.",
          "QuotaExceededError",
        );
      }
      return originalAdd.apply(this, args);
    };

    const rows = [record("g-d5", "a", 10), record("g-d5", "b", 20)];

    try {
      const failed = await addChatParticipantRows(rows);
      expect(failed).toEqual({ durableUserIds: [], retry: true });
      expect(await getChatParticipantsByGiveaway("g-d5")).toEqual([]);
      expect(warn.mock.calls.some((call) => String(call[0]).includes("participações do chat"))).toBe(true);
    } finally {
      IDBObjectStore.prototype.add = originalAdd;
    }

    const retried = await addChatParticipantRows(rows);
    expect(retried.retry).toBe(false);
    expect(retried.durableUserIds.sort()).toEqual(["a", "b"]);
    const saved = await getChatParticipantsByGiveaway("g-d5");
    expect(saved.map((row) => [row.userId, row.joinedAt]).sort()).toEqual([
      ["a", 10],
      ["b", 20],
    ]);
  });

  it("CA-D6: DB v12 sem o store não cria nada e não grava", async () => {
    await new Promise<void>((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, 12);
      request.onupgradeneeded = () => {
        const db = request.result;
        const chat = db.createObjectStore("chat-giveaways", { keyPath: "id" });
        db.createObjectStore("giveaways", { keyPath: "id" });
        chat.add(chatGiveaway("legacy"));
      };
      request.onsuccess = () => {
        request.result.close();
        resolve();
      };
      request.onerror = () => reject(request.error);
    });

    const created: string[] = [];
    const originalCreate = IDBDatabase.prototype.createObjectStore;
    IDBDatabase.prototype.createObjectStore = function (
      this: IDBDatabase,
      name: string,
      options?: IDBObjectStoreParameters,
    ) {
      created.push(name);
      return originalCreate.call(this, name, options);
    };

    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);

    try {
      const outcome = await addChatParticipantRows([
        record("legacy", "viewer", 30),
      ]);
      expect(outcome).toEqual({ durableUserIds: [], retry: false });
      expect(created).toEqual([]);
      expect(warn).not.toHaveBeenCalled();

      const db = await openDb();
      expect(db.version).toBe(12);
      expect([...db.objectStoreNames]).not.toContain("chat-participants");
      expect(await getChatParticipantsByGiveaway("legacy")).toEqual([]);

      const stored = await getChatGiveaway("legacy");
      expect(stored).toEqual(chatGiveaway("legacy"));
    } finally {
      IDBDatabase.prototype.createObjectStore = originalCreate;
    }
  });

  it("ignora linha sem userId e não a reescreve", async () => {
    await openDb();
    const db = await openDb();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction("chat-participants", "readwrite");
      tx.objectStore("chat-participants").add({
        id: "g-legacy:ghost",
        giveawayId: "g-legacy",
        name: "ghost",
        displayName: "Ghost",
        avatar: "",
        subscriber: false,
        joinedAt: 5,
      });
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });

    const before = await rawGetAll("chat-participants");
    expect(await getChatParticipantsByGiveaway("g-legacy")).toEqual([]);

    await addChatParticipantRows([record("g-legacy", "real", 8)]);
    const after = await rawGetAll("chat-participants");
    expect(after.find((row) => (row as { id: string }).id === "g-legacy:ghost")).toEqual(
      before[0],
    );
    expect(await getChatParticipantsByGiveaway("g-legacy")).toEqual([
      record("g-legacy", "real", 8),
    ]);
  });

  it("corrida: a confirmação e o lote não se atropelam", async () => {
    const base = chatGiveaway("g-race");
    await addChatGiveaway(base);
    const next: ChatGiveawayFormData = {
      ...base,
      winners: [...base.winners, winner("winner-b")],
      updatedAt: "2026-04-01T00:00:00.000Z",
    };
    const rows = Array.from({ length: 40 }, (_, index) =>
      record("g-race", `race-${index}`, 1_000 + index),
    );

    const writes: { op: string; store: string }[] = [];
    const proto = IDBObjectStore.prototype;
    const originalPut = proto.put;
    const originalAdd = proto.add;
    const originalDelete = proto.delete;
    proto.add = function (this: IDBObjectStore, ...args: Parameters<IDBObjectStore["add"]>) {
      writes.push({ op: "add", store: this.name });
      return originalAdd.apply(this, args);
    };
    proto.delete = function (
      this: IDBObjectStore,
      ...args: Parameters<IDBObjectStore["delete"]>
    ) {
      writes.push({ op: "delete", store: this.name });
      return originalDelete.apply(this, args);
    };

    let releaseBatch!: () => void;
    const gate = new Promise<void>((resolve) => {
      releaseBatch = resolve;
    });
    proto.put = function (this: IDBObjectStore, ...args: Parameters<IDBObjectStore["put"]>) {
      writes.push({ op: "put", store: this.name });
      if (this.name === "chat-giveaways") {
        releaseBatch();
      }
      return originalPut.apply(this, args);
    };

    try {
      const confirmPromise = updateChatGiveaway(next);
      await gate;
      const batchPromise = addChatParticipantRows(rows);
      await Promise.all([confirmPromise, batchPromise]);
    } finally {
      proto.put = originalPut;
      proto.add = originalAdd;
      proto.delete = originalDelete;
    }

    const stored = await getChatGiveaway("g-race");
    expect(stored).toEqual(next);
    expect(JSON.stringify(stored?.winners)).toBe(JSON.stringify(next.winners));
    expect(await getChatParticipantsByGiveaway("g-race")).toHaveLength(40);
    expect(writes.filter((write) => write.store === "chat-giveaways")).toEqual([
      { op: "put", store: "chat-giveaways" },
    ]);
    expect(writes.some((write) => write.op !== "add" && write.store === "chat-participants")).toBe(
      false,
    );
  });

  it("fixture v12 populada: nenhum registro existente é reescrito", async () => {
    const live = chatGiveaway("live-giveaway");
    const other = chatGiveaway("other-giveaway");
    const kept = record("live-giveaway", "old-viewer", 1_700_000_000_000);
    const orphan = {
      id: "orphan-giveaway:ghost",
      giveawayId: "orphan-giveaway",
      name: "ghost",
      displayName: "Ghost",
      avatar: "https://example.com/ghost.png",
      subscriber: false,
      joinedAt: 42,
    };

    await addChatGiveaway(live);
    await addChatGiveaway(other);
    await addExclusion({
      twitchUserId: "mod",
      username: "modbot",
      displayName: "Mod Bot",
      profileImageUrl: "https://example.com/mod.png",
      updatedAt: "2026-01-01T00:00:00.000Z",
    });
    await addGiveaway({
      id: "sub-1",
      title: "Subs de janeiro",
      description: "snapshot",
      subscriptionRequirement: 1000,
      subscriberMultiplier: { "1000": 1, "2000": 2, "3000": 3 },
      participants: [
        {
          broadcaster_id: "broadcaster-1",
          broadcaster_login: "streamer",
          broadcaster_name: "Streamer",
          gifter_id: "",
          gifter_login: "",
          is_gift: false,
          plan_name: "Tier 1",
          tier: "1000",
          user_id: "sub-user",
          user_name: "Sub User",
          user_login: "subuser",
        },
      ],
      winners: [],
      spreadsheetUrl: "https://docs.google.com/spreadsheets/d/abc",
    });
    await addChannelPointsGiveaway({
      id: "points-1",
      title: "Pontos",
      description: "coleta",
      cost: 500,
      rewardId: "reward-1",
      rewardEnabled: true,
      maxPerStream: 2,
      subscribersOnly: false,
      subscriptionRequirement: 0,
      subscriberMultiplier: { "1000": 1, "2000": 2, "3000": 3 },
      refundIneligible: true,
      allowMultipleWins: false,
      status: "ready",
      participants: [
        {
          userId: "points-user",
          name: "pointsuser",
          displayName: "Points User",
          avatar: "https://example.com/points.png",
          subscriber: false,
          tickets: [
            { redemptionId: "red-1", redeemedAt: "2026-02-01T00:00:00.000Z" },
          ],
        },
      ],
      winners: [],
      createdAt: "2026-02-01T00:00:00.000Z",
      updatedAt: "2026-02-01T00:00:00.000Z",
    });
    await addRoulette({
      id: "roulette-1",
      title: "Roleta",
      options: ["Sim", "Não"],
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-01T00:00:00.000Z",
    });
    await addTemplate({
      id: "tpl-1",
      name: "Padrão",
      settings: {
        title: "Template",
        description: "",
        keyword: "!join",
        cost: 0,
        minimumSuscriptionTimeInMonths: 0,
        subscriberMultiplier: 1,
        subscribersOnly: false,
      },
      createdAt: "2026-01-01T00:00:00.000Z",
      sortOrder: 0,
    });

    const db = await openDb();
    expect(db.version).toBe(12);
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction("chat-participants", "readwrite");
      const store = tx.objectStore("chat-participants");
      store.add(kept);
      store.add(orphan);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });

    const stores = [
      "exclusion-list",
      "giveaways",
      "chat-giveaways",
      "chat-giveaway-templates",
      "chat-participants",
      "roulettes",
      "channel-points-giveaways",
    ];
    const before = Object.fromEntries(
      await Promise.all(stores.map(async (name) => [name, await rawGetAll(name)] as const)),
    );
    const storageBefore = storageFingerprint();

    const fresh = record("live-giveaway", "old-viewer", 9_999_999);
    const newbie = record("live-giveaway", "newbie", 3_000);
    await addChatParticipantRows([fresh, newbie]);

    const after = Object.fromEntries(
      await Promise.all(stores.map(async (name) => [name, await rawGetAll(name)] as const)),
    );

    for (const name of stores) {
      if (name === "chat-participants") continue;
      expect(after[name]).toEqual(before[name]);
    }

    const beforeRows = before["chat-participants"] as ChatParticipantRecord[];
    const afterRows = after["chat-participants"] as ChatParticipantRecord[];
    for (const row of beforeRows) {
      expect(afterRows.find((item) => item.id === row.id)).toEqual(row);
    }
    expect(afterRows).toHaveLength(beforeRows.length + 1);
    expect(afterRows.find((row) => row.userId === "newbie")).toEqual(newbie);
    expect(await getChatParticipantsByGiveaway("orphan-giveaway")).toEqual([]);
    expect((await openDb()).version).toBe(12);
    expect(storageFingerprint()).toEqual(storageBefore);
    expect(await getChatGiveaway("live-giveaway")).toEqual(live);
    expect(await getChatGiveaway("other-giveaway")).toEqual(other);
  });
});
