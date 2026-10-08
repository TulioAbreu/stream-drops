import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { waitFor } from "@testing-library/react";
import { clearDatabase, openDb } from ".";
import { useChannelPointsGiveawayDb } from "./ChannelPointsGiveaway";
import {
  useChatGiveawayDb,
  type ChatGiveawayFormData,
  type ChatGiveawayWinner,
} from "./ChatGiveaway";
import type { ChatParticipantRecord } from "./chat-participants";
import { useSubscriptionGiveawayDb } from "./SubscriptionGiveaway";
import {
  buildWinnerIndexFromDatabase,
  computeAchievements,
  computeMomentBadges,
  computeStats,
  readWinnerHistorySource,
  resetWinnerIndexSession,
  startWinnerIndex,
  useWinnerIndexStore,
  type EngineClock,
  type WinEvent,
} from "@/lib/winner-badges";

/* eslint-disable react-hooks/rules-of-hooks */
const chatDb = useChatGiveawayDb();
const pointsDb = useChannelPointsGiveawayDb();
const subscriberDb = useSubscriptionGiveawayDb();
/* eslint-enable react-hooks/rules-of-hooks */

const NOW = "2026-10-08T18:00:00.000Z";
const CLOCK: EngineClock = {
  now: "2026-10-10T15:00:00.000Z",
  timeZone: "America/Sao_Paulo",
};

const STORES = [
  "exclusion-list",
  "giveaways",
  "chat-giveaways",
  "chat-giveaway-templates",
  "chat-participants",
  "roulettes",
  "channel-points-giveaways",
] as const;

type Write = {
  op: "put" | "add" | "delete";
  store: string;
  key: string;
  tx: IDBTransaction;
};

function bytes(value: unknown): number {
  return new TextEncoder().encode(JSON.stringify(value)).length;
}

function storageSnapshot() {
  return {
    local: Object.keys(localStorage)
      .sort()
      .map((key) => [key, localStorage.getItem(key)]),
    session: Object.keys(sessionStorage)
      .sort()
      .map((key) => [key, sessionStorage.getItem(key)]),
    cookie: document.cookie,
  };
}

async function putRaw(storeName: string, records: unknown[]): Promise<void> {
  const db = await openDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(storeName, "readwrite");
    const store = tx.objectStore(storeName);
    for (const record of records) store.put(record);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error);
  });
}

async function readRaw<T>(storeName: string, id: string): Promise<T | undefined> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, "readonly");
    const request = tx.objectStore(storeName).get(id);
    request.onsuccess = () => resolve(request.result as T | undefined);
    request.onerror = () => reject(request.error);
  });
}

async function dumpDatabase(): Promise<{ version: number; body: string }> {
  const db = await openDb();
  const stores: Record<string, unknown[]> = {};
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction([...STORES], "readonly");
    for (const name of STORES) {
      const request = tx.objectStore(name).getAll();
      request.onsuccess = () => {
        const rows = [...(request.result as Array<{ id?: string; twitchUserId?: string }>)];
        rows.sort((left, right) => {
          const leftKey = String(left.id ?? left.twitchUserId ?? "");
          const rightKey = String(right.id ?? right.twitchUserId ?? "");
          return leftKey.localeCompare(rightKey);
        });
        stores[name] = rows;
      };
    }
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error);
  });
  return { version: db.version, body: JSON.stringify(stores) };
}

function withoutGiveaway(body: string, giveawayId: string): string {
  const stores = JSON.parse(body) as Record<string, Array<Record<string, unknown>>>;
  for (const name of Object.keys(stores)) {
    stores[name] = stores[name]?.filter((row) => {
      if (row.id === giveawayId) return false;
      if (row.giveawayId === giveawayId) return false;
      return true;
    }) ?? [];
  }
  return JSON.stringify(stores);
}

function installWriteSpy() {
  const writes: Write[] = [];
  const readwrite: IDBTransaction[] = [];
  const originalTransaction = IDBDatabase.prototype.transaction;
  const originalPut = IDBObjectStore.prototype.put;
  const originalAdd = IDBObjectStore.prototype.add;
  const originalDelete = IDBObjectStore.prototype.delete;

  IDBDatabase.prototype.transaction = function (
    storeNames: string | Iterable<string>,
    mode?: IDBTransactionMode,
    options?: IDBTransactionOptions,
  ) {
    const tx = originalTransaction.call(this, storeNames, mode, options);
    if ((mode ?? "readonly") === "readwrite") readwrite.push(tx);
    return tx;
  };
  IDBObjectStore.prototype.put = function (
    this: IDBObjectStore,
    value: unknown,
    key?: IDBValidKey,
  ) {
    const record = value as { id?: string };
    writes.push({
      op: "put",
      store: this.name,
      key: String(key ?? record.id ?? ""),
      tx: this.transaction,
    });
    return originalPut.call(this, value, key);
  };
  IDBObjectStore.prototype.add = function (
    this: IDBObjectStore,
    value: unknown,
    key?: IDBValidKey,
  ) {
    const record = value as { id?: string };
    writes.push({
      op: "add",
      store: this.name,
      key: String(key ?? record.id ?? ""),
      tx: this.transaction,
    });
    return originalAdd.call(this, value, key);
  };
  IDBObjectStore.prototype.delete = function (
    this: IDBObjectStore,
    key: IDBValidKey,
  ) {
    writes.push({
      op: "delete",
      store: this.name,
      key: String(key),
      tx: this.transaction,
    });
    return originalDelete.call(this, key);
  };

  return {
    writes,
    readwrite,
    restore() {
      IDBDatabase.prototype.transaction = originalTransaction;
      IDBObjectStore.prototype.put = originalPut;
      IDBObjectStore.prototype.add = originalAdd;
      IDBObjectStore.prototype.delete = originalDelete;
    },
  };
}

function chatPerson(
  id: string,
  joinedAt: number,
  extra: Partial<{
    displayName: string;
    subscriptionMonths: number;
    tier: 1000 | 2000 | 3000;
  }> = {},
) {
  return {
    id,
    name: id,
    displayName: extra.displayName ?? `Nome ${id}`,
    avatar: `https://example.test/${id}.png`,
    subscriber: true,
    subscriptionMonths: extra.subscriptionMonths,
    tier: extra.tier,
    joinedAt,
  };
}

function chatRow(
  giveawayId: string,
  userId: string,
  joinedAt: number,
  displayName: string,
): ChatParticipantRecord {
  return {
    id: `${giveawayId}:${userId}`,
    giveawayId,
    userId,
    name: userId,
    displayName,
    avatar: `https://example.test/${userId}.png`,
    subscriber: false,
    joinedAt,
  };
}

function chatWinner(
  twitchId: string,
  drawnAt: string,
  context?: ChatGiveawayWinner["context"],
): ChatGiveawayWinner {
  const winner: ChatGiveawayWinner = {
    id: twitchId,
    name: `Vencedor ${twitchId}`,
    twitchId,
    avatar: `https://example.test/${twitchId}.png`,
    drawnAt,
  };
  if (context) winner.context = context;
  return winner;
}

function chatGiveaway(
  id: string,
  winners: ChatGiveawayWinner[],
  participants: ReturnType<typeof chatPerson>[] = [],
): ChatGiveawayFormData {
  return {
    id,
    title: `Sorteio ${id}`,
    description: "descrição salva",
    keyword: "!join",
    cost: 0,
    minimumSuscriptionTimeInMonths: 0,
    subscriberMultiplier: 2,
    subscribersOnly: false,
    winners,
    participants,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-02T00:00:00.000Z",
  };
}

function subscriber(userId: string, drawnAt?: string) {
  const record: Record<string, unknown> = {
    broadcaster_id: "9",
    broadcaster_login: "canal",
    broadcaster_name: "Canal",
    gifter_id: "",
    gifter_login: "",
    is_gift: false,
    plan_name: "Tier 1",
    tier: "1000",
    user_id: userId,
    user_name: "Viewer",
    user_login: "viewer",
  };
  if (drawnAt) record.drawnAt = drawnAt;
  return record;
}

function pointsGiveaway(
  id: string,
  participants: unknown[],
  winners: unknown[],
) {
  return {
    id,
    title: `Pontos ${id}`,
    description: "pontos",
    cost: 100,
    rewardId: null,
    maxPerStream: null,
    subscribersOnly: false,
    subscriptionRequirement: 1000,
    subscriberMultiplier: { "1000": 1, "2000": 2, "3000": 3 },
    refundIneligible: false,
    allowMultipleWins: false,
    status: "ready",
    participants,
    winners,
    collectionProgress: { loaded: 3, page: 1 },
    createdAt: "2026-02-01T00:00:00.000Z",
    updatedAt: "2026-02-02T00:00:00.000Z",
  };
}

async function seedNeighbors(activeChatId = "chat-vizinho") {
  await putRaw("chat-giveaways", [
    chatGiveaway(activeChatId, [chatWinner("vizinho", "2026-09-01T12:00:00.000Z")]),
  ]);
  await putRaw("chat-participants", [
    chatRow(activeChatId, "vizinho", 1_600_000_000_000, "Vizinho"),
  ]);
  await putRaw("channel-points-giveaways", [
    pointsGiveaway("points-vizinho", [], [
      {
        id: "w-viz",
        userId: "vizinho",
        name: "Vizinho",
        avatar: "v.png",
        redemptionId: "r-viz",
        drawnAt: "2026-09-02T12:00:00.000Z",
      },
    ]),
  ]);
  await putRaw("giveaways", [
    {
      id: "sub-vizinho",
      title: "Subs vizinho",
      description: "fica",
      subscriptionRequirement: 1000,
      subscriberMultiplier: { "1000": 1, "2000": 2, "3000": 3 },
      participants: [subscriber("vizinho")],
      winners: [subscriber("vizinho")],
      spreadsheetUrl: null,
    },
  ]);
  await putRaw("exclusion-list", [
    {
      twitchUserId: "mod",
      username: "modbot",
      displayName: "Mod",
      profileImageUrl: "",
      updatedAt: "2026-01-01T00:00:00.000Z",
    },
  ]);
  await putRaw("chat-giveaway-templates", [
    {
      id: "template-1",
      name: "Padrão",
      settings: { title: "Modelo", keyword: "!join" },
      createdAt: "2026-01-01T00:00:00.000Z",
    },
  ]);
  await putRaw("roulettes", [
    { id: "roleta-1", title: "Roleta", options: ["A", "B"] },
  ]);
}

describe("soft-delete de sorteios", () => {
  beforeEach(async () => {
    await clearDatabase();
    resetWinnerIndexSession();
    localStorage.setItem(
      "login-storage",
      JSON.stringify({ state: { twitchAccessToken: "token-s4" } }),
    );
    sessionStorage.setItem("sd-s4", "1");
    document.cookie = "sd_s4=1; path=/";
  });

  afterEach(() => {
    resetWinnerIndexSession();
    localStorage.removeItem("login-storage");
    sessionStorage.removeItem("sd-s4");
    document.cookie = "sd_s4=; path=/; max-age=0";
  });

  it("CA19 e CA21: soft-delete mantém as vitórias e some das listas", async () => {
    const userId = "viewer-u";
    await seedNeighbors();
    await putRaw("chat-giveaways", [
      chatGiveaway("sorteio-x", [
        chatWinner(userId, "2026-10-01T15:00:00.000Z", {
          subscriptionMonths: 6,
          tier: 1000,
        }),
      ]),
      chatGiveaway("sorteio-y", [chatWinner(userId, "2026-10-02T15:00:00.000Z")]),
    ]);
    await putRaw("channel-points-giveaways", [
      pointsGiveaway(
        "sorteio-z",
        [],
        [
          {
            id: "w-z",
            userId,
            name: "Viewer",
            avatar: "u.png",
            redemptionId: "r-z",
            drawnAt: "2026-10-03T15:00:00.000Z",
          },
        ],
      ),
    ]);

    const beforeIndex = await buildWinnerIndexFromDatabase();
    const beforeStats = computeStats(beforeIndex, CLOCK).viewers.find(
      (viewer) => viewer.userKey === `twitch:${userId}`,
    );
    expect(beforeStats?.totals.all).toBe(3);
    expect(
      computeAchievements(beforeIndex, CLOCK).some(
        (badge) => badge.userKey === `twitch:${userId}` && badge.id === "lucky_3",
      ),
    ).toBe(true);

    resetWinnerIndexSession();
    startWinnerIndex();
    await waitFor(() => {
      expect(useWinnerIndexStore.getState().status).toBe("ready");
    });
    const live = useWinnerIndexStore.getState().index;
    const untouched = live?.getWins().find((win) => win.giveawayId === "sorteio-y");
    const removed = live?.getWins().find((win) => win.giveawayId === "sorteio-x");

    const storageBefore = storageSnapshot();
    await chatDb.softDeleteChatGiveaway("sorteio-x", NOW);

    const listed = await chatDb.getChatGiveaways();
    expect(listed.map((row) => row.id)).not.toContain("sorteio-x");
    expect(listed.map((row) => row.id)).toContain("sorteio-y");
    expect(await chatDb.getChatGiveaway("sorteio-x")).toBeUndefined();
    const kept = await chatDb.getChatGiveawayIncludingDeleted("sorteio-x");
    expect(kept?.deletedAt).toBe(NOW);
    expect(kept?.participants).toEqual([]);

    const source = await readWinnerHistorySource();
    expect(
      (source.chat as Array<{ id: string }>).some((row) => row.id === "sorteio-x"),
    ).toBe(true);

    const afterIndex = await buildWinnerIndexFromDatabase();
    const afterStats = computeStats(afterIndex, CLOCK).viewers.find(
      (viewer) => viewer.userKey === `twitch:${userId}`,
    );
    expect(afterStats?.totals.all).toBe(3);
    expect(
      computeAchievements(afterIndex, CLOCK).some(
        (badge) => badge.userKey === `twitch:${userId}` && badge.id === "lucky_3",
      ),
    ).toBe(true);
    const xWin = afterIndex
      .getWins()
      .find((win) => win.giveawayId === "sorteio-x");
    expect(computeMomentBadges(afterIndex, xWin as WinEvent, CLOCK).length).toBeGreaterThan(0);

    expect(live?.getWins().some((win) => win.giveawayId === "sorteio-x")).toBe(true);
    expect(untouched && live?.getWins().includes(untouched)).toBe(true);
    expect(removed && live?.getWins().includes(removed)).toBe(false);
    expect(storageSnapshot()).toEqual(storageBefore);
    expect(storageBefore.local.some(([key]) => key === "stream-drops-settings")).toBe(
      false,
    );
  });

  it("CA20: hard delete tira a vitória e o Sortudo", async () => {
    const userId = "viewer-u";
    await putRaw("chat-giveaways", [
      chatGiveaway("sorteio-x", [chatWinner(userId, "2026-10-01T15:00:00.000Z")]),
      chatGiveaway("sorteio-y", [chatWinner(userId, "2026-10-02T15:00:00.000Z")]),
    ]);
    await putRaw("giveaways", [
      {
        id: "sorteio-s",
        title: "Subs",
        description: "",
        subscriptionRequirement: 1000,
        subscriberMultiplier: { "1000": 1, "2000": 1, "3000": 1 },
        participants: [],
        winners: [subscriber(userId, "2026-10-03T15:00:00.000Z")],
        spreadsheetUrl: null,
        createdAt: "2026-10-03T00:00:00.000Z",
        updatedAt: "2026-10-03T00:00:00.000Z",
      },
    ]);

    await chatDb.softDeleteChatGiveaway("sorteio-x", NOW);
    await chatDb.deleteChatGiveaway("sorteio-x");

    expect(await chatDb.getChatGiveawayIncludingDeleted("sorteio-x")).toBeUndefined();
    const index = await buildWinnerIndexFromDatabase();
    expect(index.getWins().some((win) => win.giveawayId === "sorteio-x")).toBe(false);
    const stats = computeStats(index, CLOCK).viewers.find(
      (viewer) => viewer.userKey === `twitch:${userId}`,
    );
    expect(stats?.totals.all).toBe(2);
    expect(
      computeAchievements(index, CLOCK).some(
        (badge) => badge.userKey === `twitch:${userId}` && badge.id === "lucky_3",
      ),
    ).toBe(false);
  });

  it("CA22: o Fiel sobrevive à poda do participante", async () => {
    await putRaw("chat-giveaways", [
      chatGiveaway(
        "fiel",
        [chatWinner("fiel-u", "2026-10-04T15:00:00.000Z")],
        [chatPerson("fiel-u", 1_700_000_000_000, {
          subscriptionMonths: 24,
          tier: 3000,
        })],
      ),
    ]);

    await chatDb.softDeleteChatGiveaway("fiel", NOW);
    const stored = await readRaw<ChatGiveawayFormData>("chat-giveaways", "fiel");
    expect(stored?.participants).toEqual([]);
    expect(stored?.winners[0]?.context).toEqual({
      subscriptionMonths: 24,
      tier: 3000,
    });

    const index = await buildWinnerIndexFromDatabase();
    const win = index.getWins().find((item) => item.userId === "fiel-u");
    const badge = computeMomentBadges(index, win as WinEvent, CLOCK).find(
      (item) => item.id === "loyal_sub",
    );
    expect(badge?.count).toBe(24);
    expect(badge?.rarity).toBe("epic");
  });

  it("CA-SD3 e CA-D9: uma transação, resumo e o resto intacto", async () => {
    const id = "chat-poda";
    const participants = Array.from({ length: 50 }, (_, index) => {
      const userId = `p${String(index).padStart(2, "0")}`;
      return chatPerson(userId, 1_700_000_000_000 + index, {
        displayName: `Registro ${userId}`,
        subscriptionMonths: 6,
        tier: 1000,
      });
    });
    const rows = [
      ...participants.map((person, index) =>
        chatRow(id, person.id, 1_700_000_500_000 + index, `Linha ${person.id}`),
      ),
      ...Array.from({ length: 10 }, (_, index) => {
        const userId = `r${String(index).padStart(2, "0")}`;
        return chatRow(id, userId, 1_800_000_000_000 + index, `Só linha ${userId}`);
      }),
    ];
    const winner = chatWinner("p00", "2026-10-04T15:00:00.000Z", {
      subscriptionMonths: 6,
      tier: 1000,
    });
    await seedNeighbors();
    await putRaw("chat-giveaways", [chatGiveaway(id, [winner], participants)]);
    await putRaw("chat-participants", rows);

    const before = await dumpDatabase();
    const beforeRecord = await readRaw<ChatGiveawayFormData>("chat-giveaways", id);
    const storageBefore = storageSnapshot();
    const spy = installWriteSpy();
    let stored: ChatGiveawayFormData | undefined;
    try {
      stored = await chatDb.softDeleteChatGiveaway(id, NOW);
    } finally {
      spy.restore();
    }

    expect(before.version).toBe(12);
    expect(spy.readwrite).toHaveLength(1);
    expect([...spy.readwrite[0]!.objectStoreNames].sort()).toEqual([
      "chat-giveaways",
      "chat-participants",
    ]);
    expect(spy.writes.filter((write) => write.op === "add")).toEqual([]);
    const puts = spy.writes.filter((write) => write.op === "put");
    expect(puts).toHaveLength(1);
    expect(puts[0]).toMatchObject({ store: "chat-giveaways", key: id });
    expect(spy.writes.every((write) => write.tx === spy.readwrite[0])).toBe(true);
    const deletedKeys = spy.writes
      .filter((write) => write.op === "delete")
      .map((write) => write.key)
      .sort();
    expect(deletedKeys).toEqual(rows.map((row) => row.id).sort());
    expect(spy.writes.filter((write) => write.op === "delete").every(
      (write) => write.store === "chat-participants",
    )).toBe(true);

    const after = await dumpDatabase();
    expect(after.version).toBe(12);
    expect(withoutGiveaway(after.body, id)).toBe(withoutGiveaway(before.body, id));
    expect(storageSnapshot()).toEqual(storageBefore);

    const disk = await readRaw<ChatGiveawayFormData>("chat-giveaways", id);
    expect(disk).toEqual(stored);
    expect(disk?.deletedAt).toBe(NOW);
    expect(disk?.participants).toEqual([]);
    expect(disk?.winners).toEqual(beforeRecord?.winners);
    expect(disk?.participation?.v).toBe(1);
    expect(disk?.participation?.users).toHaveLength(60);
    const byId = new Map(
      disk?.participation?.users.map((user) => [user[0], user]),
    );
    expect(byId.get("p00")).toEqual([
      "p00",
      "Registro p00",
      Math.floor(1_700_000_000_000 / 1000),
    ]);
    expect(byId.get("r00")).toEqual([
      "r00",
      "Só linha r00",
      Math.floor(1_800_000_000_000 / 1000),
    ]);
    expect(disk?.participation?.users.every((user) => user.length === 3)).toBe(true);
    expect(disk?.participation?.users.every((user) => typeof user[2] === "number")).toBe(
      true,
    );
    const rowsLeft = JSON.parse(after.body)["chat-participants"] as Array<{
      giveawayId?: string;
    }>;
    expect(rowsLeft.some((row) => row.giveawayId === id)).toBe(false);
    expect(rowsLeft.some((row) => row.giveawayId === "chat-vizinho")).toBe(true);

    const winsBefore = (await buildWinnerIndexFromDatabase()).getWins().length;
    expect(winsBefore).toBeGreaterThan(0);
  });

  it("CA-SD4: a poda reduz o registro e não apaga campo de vencedor", async () => {
    const id = "chat-tamanho";
    const participants = Array.from({ length: 50 }, (_, index) =>
      chatPerson(`t${index}`, 1_710_000_000_000 + index, {
        displayName: `Pessoa ${index} com avatar longo`,
        subscriptionMonths: 12,
        tier: 2000,
      }),
    );
    const winners = [
      chatWinner("t0", "2026-10-04T15:00:00.000Z", {
        subscriptionMonths: 12,
        tier: 2000,
      }),
    ];
    await putRaw("chat-giveaways", [chatGiveaway(id, winners, participants)]);
    const before = await readRaw<ChatGiveawayFormData>("chat-giveaways", id);
    await chatDb.softDeleteChatGiveaway(id, NOW);
    const after = await readRaw<ChatGiveawayFormData>("chat-giveaways", id);

    const drop = bytes(before) - bytes(after);
    const minimum = bytes(before?.participants) - bytes(after?.participation);
    const deletedAtField = `,"deletedAt":${JSON.stringify(NOW)}`.length;
    const participationKey = `,"participation":`.length;
    const emptyParticipants = "[]".length;
    const overhead = deletedAtField + participationKey + emptyParticipants;
    expect(
      drop,
      `drop=${drop} minimum=${minimum} overhead=${overhead}`,
    ).toBeGreaterThanOrEqual(minimum - overhead);
    expect(overhead).toBeLessThan(96);
    expect(drop).toBeGreaterThan(bytes(before?.participants) / 2);
    expect(after?.participants).toEqual([]);
    expect(after?.participation?.users).toHaveLength(50);

    const beforeWinner = before?.winners[0] as Record<string, unknown>;
    const afterWinner = after?.winners[0] as Record<string, unknown>;
    for (const key of Object.keys(beforeWinner)) {
      expect(afterWinner[key]).toEqual(beforeWinner[key]);
    }
  });

  it("CA-D10: Pontos guarda um resumo com a quantidade de tickets", async () => {
    const id = "points-tickets";
    const redeemed = [
      "2026-10-05T00:00:10.000Z",
      "2026-10-05T00:00:00.000Z",
      "2026-10-05T00:00:20.000Z",
    ];
    await seedNeighbors();
    await putRaw("channel-points-giveaways", [
      pointsGiveaway(
        id,
        [
          {
            userId: "points-u",
            name: "points-u",
            displayName: "Nome Pontos",
            avatar: "p.png",
            subscriber: false,
            tickets: redeemed.map((redeemedAt, index) => ({
              redemptionId: `ticket-${index}`,
              redeemedAt,
            })),
          },
        ],
        [
          {
            id: "w-points",
            userId: "points-u",
            name: "Nome Pontos",
            avatar: "p.png",
            redemptionId: "ticket-0",
            drawnAt: "2026-10-05T01:00:00.000Z",
          },
        ],
      ),
    ]);
    const before = await dumpDatabase();
    const beforeRecord = await readRaw<{
      winners: unknown[];
      collectionProgress?: unknown;
    }>("channel-points-giveaways", id);
    const spy = installWriteSpy();
    try {
      await pointsDb.softDeleteChannelPointsGiveaway(id, NOW);
    } finally {
      spy.restore();
    }

    expect(spy.readwrite).toHaveLength(1);
    expect([...spy.readwrite[0]!.objectStoreNames]).toEqual([
      "channel-points-giveaways",
    ]);
    expect(spy.writes.filter((write) => write.op === "put")).toHaveLength(1);
    expect(spy.writes.filter((write) => write.op === "delete")).toEqual([]);

    const after = await dumpDatabase();
    expect(withoutGiveaway(after.body, id)).toBe(withoutGiveaway(before.body, id));
    const stored = await readRaw<{
      deletedAt?: string;
      participants: unknown[];
      winners: unknown[];
      collectionProgress?: unknown;
      participation?: { v: number; users: unknown[] };
    }>("channel-points-giveaways", id);
    expect(stored?.participants).toEqual([]);
    expect(stored?.winners).toEqual(beforeRecord?.winners);
    expect(stored?.collectionProgress).toBeUndefined();
    expect(stored?.participation?.users).toEqual([
      [
        "points-u",
        "Nome Pontos",
        Math.floor(Date.parse("2026-10-05T00:00:00.000Z") / 1000),
        3,
      ],
    ]);
    expect(await pointsDb.getChannelPointsGiveaways()).not.toEqual(
      expect.arrayContaining([expect.objectContaining({ id })]),
    );
  });

  it("CA-SD5 e CA-D11: hard delete apaga registro e linhas na mesma transação", async () => {
    const id = "chat-hard";
    await seedNeighbors();
    await putRaw("chat-giveaways", [
      chatGiveaway(id, [chatWinner("hard-u", "2026-10-01T15:00:00.000Z")]),
    ]);
    await putRaw("chat-participants", [
      chatRow(id, "hard-u", 1_700_000_000_000, "Hard"),
      chatRow(id, "hard-b", 1_700_000_000_100, "Hard B"),
    ]);
    await putRaw("channel-points-giveaways", [
      pointsGiveaway("points-hard", [], [
        {
          id: "w-hard",
          userId: "hard-u",
          name: "Hard",
          avatar: "h.png",
          redemptionId: "r-hard",
          drawnAt: "2026-10-02T15:00:00.000Z",
        },
      ]),
    ]);

    const before = await dumpDatabase();
    const spy = installWriteSpy();
    try {
      await chatDb.deleteChatGiveaway(id);
    } finally {
      spy.restore();
    }

    expect(spy.readwrite).toHaveLength(1);
    expect([...spy.readwrite[0]!.objectStoreNames].sort()).toEqual([
      "chat-giveaways",
      "chat-participants",
    ]);
    expect(spy.writes.filter((write) => write.op === "put")).toEqual([]);
    expect(spy.writes.map((write) => `${write.store}:${write.key}`).sort()).toEqual(
      [
        "chat-giveaways:chat-hard",
        "chat-participants:chat-hard:hard-b",
        "chat-participants:chat-hard:hard-u",
      ].sort(),
    );

    const after = await dumpDatabase();
    expect(withoutGiveaway(after.body, id)).toBe(withoutGiveaway(before.body, id));
    expect(await readRaw("chat-giveaways", id)).toBeUndefined();
    const rows = JSON.parse(after.body)["chat-participants"] as Array<{
      giveawayId?: string;
    }>;
    expect(rows.some((row) => row.giveawayId === id)).toBe(false);

    resetWinnerIndexSession();
    startWinnerIndex();
    await waitFor(() => {
      expect(useWinnerIndexStore.getState().status).toBe("ready");
    });
    const live = useWinnerIndexStore.getState().index;
    const kept = live?.getWins().find((win) => win.giveawayId === "points-hard");
    const spyPoints = installWriteSpy();
    try {
      await pointsDb.deleteChannelPointsGiveaway("points-hard");
    } finally {
      spyPoints.restore();
    }
    expect(live?.getWins().some((win) => win.giveawayId === "chat-hard")).toBe(false);
    expect(live?.getWins().some((win) => win.giveawayId === "points-hard")).toBe(false);
    expect(kept && live?.getWins().includes(kept)).toBe(false);
    const rebuilt = await buildWinnerIndexFromDatabase();
    expect(rebuilt.getWins().some((win) => win.giveawayId === "chat-hard")).toBe(false);
    expect(rebuilt.getWins().some((win) => win.giveawayId === "points-hard")).toBe(false);
    expect(rebuilt.getWins().some((win) => win.giveawayId === "chat-vizinho")).toBe(true);
  });

  it("CA-SD6: sem deletedAt, listas e detalhes seguem iguais e nada é escrito", async () => {
    await seedNeighbors("chat-ativo");
    await putRaw("giveaways", [
      {
        id: "sub-antigo",
        title: "Antigo",
        description: "sem data",
        subscriptionRequirement: 1000,
        subscriberMultiplier: { "1000": 1, "2000": 2, "3000": 3 },
        participants: [subscriber("legado")],
        winners: [subscriber("legado")],
        spreadsheetUrl: null,
      },
    ]);
    const before = await dumpDatabase();
    const storageBefore = storageSnapshot();
    const spy = installWriteSpy();
    try {
      const chats = await chatDb.getChatGiveaways();
      const points = await pointsDb.getChannelPointsGiveaways();
      const subs = await subscriberDb.getGiveaways();
      expect(chats.map((row) => row.id).sort()).toEqual(["chat-ativo"]);
      expect(points.map((row) => row.id)).toContain("points-vizinho");
      expect(subs.map((row) => row.id).sort()).toEqual(["sub-antigo", "sub-vizinho"]);
      expect(await chatDb.getChatGiveaway("chat-ativo")).toMatchObject({
        id: "chat-ativo",
      });
      expect(await subscriberDb.getGiveaway("sub-antigo")).toMatchObject({
        id: "sub-antigo",
      });
      expect(
        (await subscriberDb.getGiveaway("sub-antigo"))?.winners[0],
      ).not.toHaveProperty("drawnAt");
      const index = await buildWinnerIndexFromDatabase();
      computeStats(index, CLOCK);
      computeAchievements(index, CLOCK);
    } finally {
      spy.restore();
    }

    expect(spy.readwrite).toEqual([]);
    const after = await dumpDatabase();
    expect(after.version).toBe(12);
    expect(after.body).toBe(before.body);
    expect(storageSnapshot()).toEqual(storageBefore);
  });

  it("soft-delete de Subscribers não inventa participation nem drawnAt", async () => {
    const id = "sub-poda";
    const record = {
      id,
      title: "Legado",
      description: "sem timestamps",
      subscriptionRequirement: 1000,
      subscriberMultiplier: { "1000": 1, "2000": 2, "3000": 3 },
      participants: [subscriber("sub-u"), subscriber("sub-b")],
      winners: [subscriber("sub-u")],
      spreadsheetUrl: null,
    };
    await putRaw("giveaways", [record]);
    const before = await readRaw<Record<string, unknown>>("giveaways", id);
    await subscriberDb.softDeleteGiveaway(id, NOW);
    const after = await readRaw<Record<string, unknown>>("giveaways", id);
    expect(after?.deletedAt).toBe(NOW);
    expect(after?.participants).toEqual([]);
    expect(after?.winners).toEqual(before?.winners);
    expect(after).not.toHaveProperty("participation");
    expect(after).not.toHaveProperty("createdAt");
    expect(after).not.toHaveProperty("updatedAt");
    expect(after?.winners).toEqual([
      expect.not.objectContaining({ drawnAt: expect.anything() }),
    ]);
    expect(await subscriberDb.getGiveaway(id)).toBeUndefined();
    expect(await subscriberDb.updateGiveaway({
      ...(after as never),
      title: "não pode voltar",
    })).resolves.toBeUndefined();
    const still = await readRaw<Record<string, unknown>>("giveaways", id);
    expect(still?.title).toBe("Legado");
    expect(still?.deletedAt).toBe(NOW);
  });
});
