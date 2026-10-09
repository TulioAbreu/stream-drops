import { renderHook, waitFor } from "@testing-library/react";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { clearDatabase, openDb } from "@/database";
import {
  buildWinnerIndexFromDatabase,
  computeAchievements,
  computeMomentBadges,
  computeStats,
  createWinnerIndex,
  createWinnerIndexFromSource,
  readCardBadges,
  readWinnerHistorySource,
  resetWinnerIndexSession,
  selectForDisplay,
  startWinnerIndex,
  useCardBadges,
  useWinnerIndexStore,
  type EngineClock,
  type GiveawayType,
  type WinEvent,
  type WinnerHistorySource,
  type WinnerIndex,
} from "./index";

const ZONE = "America/Sao_Paulo";
const CLOCK: EngineClock = {
  now: "2026-10-10T15:00:00.000Z",
  timeZone: ZONE,
};
const TEMPORAL = [
  "first_drop",
  "streak_daily",
  "double_day",
  "hat_trick_24h",
  "month_regular",
  "month_lead",
  "comeback",
];

function subscriber(
  userId: string,
  extra: { is_gift?: boolean; drawnAt?: string; name?: string } = {},
) {
  const gift = extra.is_gift ?? false;
  const record: Record<string, unknown> = {
    broadcaster_id: "9",
    broadcaster_login: "canal",
    broadcaster_name: "Canal",
    gifter_id: gift ? "8" : "",
    gifter_login: gift ? "gifter" : "",
    is_gift: gift,
    plan_name: "Tier 1",
    tier: "1000",
    user_id: userId,
    user_name: extra.name ?? "Ana",
    user_login: "ana",
  };
  if (extra.drawnAt) record.drawnAt = extra.drawnAt;
  return record;
}

function digest(wins: readonly WinEvent[]): string {
  return JSON.stringify(
    wins.map((win) => ({
      userKey: win.userKey,
      platform: win.platform,
      userId: win.userId,
      giveawayType: win.giveawayType,
      giveawayId: win.giveawayId,
      index: win.index,
      wonAt: win.wonAt ?? null,
      name: win.name,
      avatar: win.avatar ?? null,
      context: win.context ?? null,
    })),
  );
}

function expectSameHistory(index: WinnerIndex, source: WinnerHistorySource) {
  const rebuilt = createWinnerIndexFromSource(source);
  expect(digest(index.getWins())).toBe(digest(rebuilt.getWins()));
  for (const [userKey, wins] of index.byUser) {
    expect(digest(wins)).toBe(digest(rebuilt.byUser.get(userKey) ?? []));
    const fromGlobal = index.getWins().filter((win) => win.userKey === userKey);
    expect(fromGlobal.length).toBe(wins.length);
    fromGlobal.forEach((win, position) => {
      expect(win).toBe(wins[position]);
    });
  }
}

function idsOf(win: WinEvent | undefined, index: WinnerIndex): string[] {
  if (!win) throw new Error("vitória ausente");
  return computeMomentBadges(index, win, CLOCK).map((badge) => badge.id);
}

const chat = [
  {
    id: "chat-1",
    title: "Chat da Ana",
    keyword: "!drop",
    winners: [
      {
        id: "42",
        name: "Ana",
        twitchId: "42",
        avatar: "ana.png",
        drawnAt: "2026-10-08T15:00:00.000Z",
      },
    ],
    participants: [
      {
        id: "42",
        name: "ana",
        displayName: "Ana",
        avatar: "ana.png",
        subscriber: true,
        subscriptionMonths: 3,
        tier: 1000,
        joinedAt: 1_700_000_000_000,
      },
    ],
    createdAt: "2026-10-08T12:00:00.000Z",
    updatedAt: "2026-10-08T15:00:00.000Z",
  },
  {
    id: "sem-participants",
    winners: [
      {
        id: "1",
        name: "SemLista",
        twitchId: "1",
        avatar: "a.png",
        drawnAt: "2026-10-04T15:00:00.000Z",
      },
    ],
  },
  {
    id: "sem-meses",
    winners: [
      {
        name: "SemMeses",
        twitchId: "2",
        avatar: null,
        drawnAt: "2026-10-04T15:00:00.000Z",
      },
    ],
    participants: [{ id: "2", tier: null, subscriptionMonths: null }],
  },
  {
    id: "context-nulo",
    winners: [
      {
        name: "ComContext",
        twitchId: "3",
        drawnAt: "2026-10-04T15:00:00.000Z",
        context: { subscriptionMonths: null, tier: null },
      },
    ],
    participants: [
      { id: "3", subscriptionMonths: 24, tier: 1000, joinedAt: 1 },
    ],
  },
  {
    id: "fiel-legado",
    winners: [
      {
        id: "4",
        name: "Fiel",
        twitchId: "4",
        avatar: "f.png",
        drawnAt: "2026-10-04T15:00:00.000Z",
      },
    ],
    participants: [
      {
        id: "4",
        name: "fiel",
        displayName: "Fiel",
        avatar: "f.png",
        subscriber: true,
        subscriptionMonths: 24,
        tier: 3000,
        joinedAt: 1_700_000_000_000,
      },
    ],
  },
  {
    id: "chat-unknown",
    winners: [
      {
        twitchId: "unknown",
        name: "???",
        avatar: "x",
        drawnAt: "2026-10-03T15:00:00.000Z",
      },
      {
        twitchId: "77",
        name: "Valido",
        avatar: "v.png",
        drawnAt: "2026-10-03T15:00:00.000Z",
      },
    ],
  },
  {
    id: "chat-apagado",
    title: "Apagado",
    deletedAt: "2026-10-01T00:00:00.000Z",
    participants: [],
    participation: {
      v: 1,
      users: [["soft-user", "Soft", 1_700_000_000]],
    },
    winners: [
      {
        id: "soft-user",
        name: "Soft",
        twitchId: "soft-user",
        avatar: "s.png",
        drawnAt: "2026-10-02T15:00:00.000Z",
      },
    ],
  },
  {
    id: "chat-participation-ruim",
    deletedAt: "2026-10-03T00:00:00.000Z",
    participants: [],
    participation: { v: 2, users: "nope" },
    winners: [
      {
        id: "bad-part",
        name: "Ruim",
        twitchId: "bad-part",
        avatar: "r.png",
        drawnAt: "2026-10-04T12:00:00.000Z",
      },
    ],
  },
  { id: "incompleto" },
  { id: "winners-nulos", winners: null, participants: null },
];

const channelPoints = [
  {
    id: "cp-1",
    allowMultipleWins: false,
    winners: [
      {
        id: "w-42",
        userId: "42",
        name: "Ana",
        avatar: "ana.png",
        redemptionId: "r1",
        drawnAt: "2026-10-09T15:00:00.000Z",
      },
    ],
  },
  {
    id: "cp-unknown",
    allowMultipleWins: true,
    winners: [
      {
        id: "u",
        userId: "unknown",
        name: "???",
        avatar: "x",
        redemptionId: "r",
        drawnAt: "2026-10-03T15:00:00.000Z",
      },
    ],
  },
];

const subscribers = [
  {
    id: "sub-legado",
    title: "Legado",
    winners: [
      subscriber("42", { is_gift: true }),
      subscriber("42", { is_gift: false }),
    ],
  },
  {
    id: "sub-novo",
    winners: [
      subscriber("99", {
        drawnAt: "2026-10-07T15:00:00.000Z",
        is_gift: false,
        name: "Novo",
      }),
    ],
  },
  {
    id: "sub-unknown",
    winners: [subscriber("unknown"), subscriber("77", { name: "Valido" })],
  },
];

const chatParticipants = [
  {
    id: "chat-1:42",
    giveawayId: "chat-1",
    userId: "42",
    name: "ana",
    displayName: "Ana",
    avatar: "ana.png",
    subscriber: true,
    subscriptionMonths: 3,
    tier: 1000,
    joinedAt: 1_700_000_000_000,
  },
  {
    id: "chat-1:extra",
    giveawayId: "chat-1",
    userId: "extra",
    name: "extra",
    displayName: "Extra",
    avatar: "e.png",
    subscriber: false,
    joinedAt: 1_700_000_001_000,
  },
];

function sortValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sortValue);
  if (!value || typeof value !== "object") return value;
  const record = value as Record<string, unknown>;
  const sorted: Record<string, unknown> = {};
  for (const key of Object.keys(record).sort()) {
    sorted[key] = sortValue(record[key]);
  }
  return sorted;
}

function rowKey(row: unknown): string {
  if (row && typeof row === "object" && "id" in row) {
    return String((row as { id?: unknown }).id);
  }
  if (row && typeof row === "object" && "twitchUserId" in row) {
    return String((row as { twitchUserId?: unknown }).twitchUserId);
  }
  return JSON.stringify(sortValue(row));
}

async function snapshotDatabase(): Promise<{ version: number; name: string; body: string }> {
  const db = await openDb();
  const names = [...db.objectStoreNames];
  const stores: Record<string, unknown[]> = {};
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(names, "readonly");
    for (const name of names) {
      const request = tx.objectStore(name).getAll();
      request.onsuccess = () => {
        const rows = [...(request.result as unknown[])];
        rows.sort((left, right) => rowKey(left).localeCompare(rowKey(right)));
        stores[name] = rows;
      };
    }
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error);
  });
  return {
    version: db.version,
    name: db.name,
    body: JSON.stringify(sortValue(stores)),
  };
}

function snapshotStorage() {
  const localKeys = Object.keys(localStorage).sort();
  const sessionKeys = Object.keys(sessionStorage).sort();
  return {
    local: localKeys.map((key) => [key, localStorage.getItem(key)]),
    session: sessionKeys.map((key) => [key, sessionStorage.getItem(key)]),
    cookie: document.cookie,
  };
}

async function seedAcceptanceDb(): Promise<void> {
  const db = await openDb();
  const stores: Record<string, unknown[]> = {
    "chat-giveaways": chat,
    "channel-points-giveaways": channelPoints,
    giveaways: subscribers,
    "chat-participants": chatParticipants,
  };
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(Object.keys(stores), "readwrite");
    for (const [name, records] of Object.entries(stores)) {
      const store = tx.objectStore(name);
      for (const record of records) store.put(record);
    }
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error);
  });
}

describe("índice a partir do IndexedDB v12", () => {
  let dbBefore: { version: number; name: string; body: string };
  let storageBefore: ReturnType<typeof snapshotStorage>;

  beforeAll(async () => {
    await clearDatabase();
    await seedAcceptanceDb();
    localStorage.setItem("sd-s2-canary", "1");
    sessionStorage.setItem("sd-s2-canary", "1");
    document.cookie = "sd_s2_canary=1; path=/";
    dbBefore = await snapshotDatabase();
    storageBefore = snapshotStorage();
  }, 30_000);

  afterAll(async () => {
    localStorage.removeItem("sd-s2-canary");
    sessionStorage.removeItem("sd-s2-canary");
    document.cookie = "sd_s2_canary=; path=/; max-age=0";
    await clearDatabase();
  }, 30_000);

  it("CA13: legado sem drawnAt conta; drawnAt presente vira wonAt", async () => {
    const source = await readWinnerHistorySource();
    const index = await buildWinnerIndexFromDatabase();
    expect(digest(index.getWins())).toBe(
      digest(createWinnerIndexFromSource(source).getWins()),
    );

    const legacy = index
      .getWins()
      .filter(
        (win) => win.userId === "42" && win.giveawayType === "subscribers",
      );
    expect(legacy).toHaveLength(2);
    expect(legacy.every((win) => win.wonAt === undefined)).toBe(true);
    const dated = index.getWins().find((win) => win.userId === "99");
    expect(dated?.wonAt).toBe("2026-10-07T15:00:00.000Z");

    const viewer = computeStats(index, CLOCK).viewers.find(
      (item) => item.userKey === "twitch:42",
    );
    expect(viewer?.totals.all).toBe(4);
    expect(viewer?.totals.subscribers).toBe(2);
    expect(viewer?.undatedWins).toBe(2);
    expect(
      computeAchievements(index, CLOCK).some(
        (badge) => badge.userKey === "twitch:42" && badge.id === "lucky_3",
      ),
    ).toBe(true);
    expect(
      computeAchievements(index, CLOCK).some(
        (badge) => badge.userKey === "twitch:42" && badge.id === "collector",
      ),
    ).toBe(true);

    const undated = legacy[0];
    const onLegacy = idsOf(undated, index);
    expect(onLegacy).toContain("gifted_sub");
    for (const id of TEMPORAL) expect(onLegacy).not.toContain(id);

    const chatWin = index.getWins().find(
      (win) => win.userId === "42" && win.giveawayType === "chat",
    );
    expect(idsOf(chatWin, index)).not.toContain("first_drop");
    expect(idsOf(dated, index)).toContain("first_drop");
  });

  it("CA14: registro incompleto não quebra e não dá Fiel", async () => {
    const index = await buildWinnerIndexFromDatabase();
    for (const userId of ["1", "2", "3"]) {
      const win = index.getWins().find((item) => item.userId === userId);
      expect(win).toBeDefined();
      expect(
        computeMomentBadges(index, win as WinEvent, CLOCK).some(
          (badge) => badge.id === "loyal_sub",
        ),
      ).toBe(false);
    }
    const loyal = index.getWins().find((item) => item.userId === "4");
    expect(loyal?.context).toEqual({
      subscriptionMonths: 24,
      tier: "3000",
    });
    const badge = computeMomentBadges(index, loyal as WinEvent, CLOCK).find(
      (item) => item.id === "loyal_sub",
    );
    expect(badge?.rarity).toBe("epic");
    expect(badge?.count).toBe(24);
    expect(index.getWins().some((win) => win.giveawayId === "incompleto")).toBe(
      false,
    );
  });

  it("CA15: twitchId unknown fica fora do índice", async () => {
    const index = await buildWinnerIndexFromDatabase();
    expect(index.getWins().some((win) => win.userId === "unknown")).toBe(false);
    expect(
      index.getWins().some((win) => win.userKey.endsWith(":unknown")),
    ).toBe(false);
    const kept = index.getWins().filter((win) => win.userId === "77");
    expect(kept.map((win) => win.index).sort()).toEqual([1, 1]);
    const stats = computeStats(index, CLOCK);
    expect(stats.viewers.some((viewer) => viewer.userKey.includes("unknown"))).toBe(
      false,
    );
  });

  it("deletedAt entra no índice e participation v:2 não derruba a leitura", async () => {
    const index = await buildWinnerIndexFromDatabase();
    expect(
      index.getWins().some(
        (win) => win.giveawayId === "chat-apagado" && win.userId === "soft-user",
      ),
    ).toBe(true);
    expect(
      index.getWins().some(
        (win) =>
          win.giveawayId === "chat-participation-ruim" &&
          win.userId === "bad-part",
      ),
    ).toBe(true);
  });

  it("CA-SD1: montar o índice e calcular selos não escreve e segue na v12", async () => {
    const original = IDBDatabase.prototype.transaction;
    const modes: string[] = [];
    IDBDatabase.prototype.transaction = function (
      storeNames: string | Iterable<string>,
      mode?: IDBTransactionMode,
      options?: IDBTransactionOptions,
    ) {
      modes.push(mode ?? "readonly");
      return original.call(this, storeNames, mode, options);
    };

    try {
      const index = await buildWinnerIndexFromDatabase();
      const sample = index.getWins().find((win) => win.userId === "99");
      expect(sample).toBeDefined();
      const awards = computeMomentBadges(index, sample as WinEvent, CLOCK);
      computeAchievements(index, CLOCK);
      computeStats(index, CLOCK);
      selectForDisplay(awards);
      index.insertWin({
        userKey: "twitch:memoria",
        platform: "twitch",
        userId: "memoria",
        giveawayType: "chat",
        giveawayId: "so-memoria",
        index: 0,
        wonAt: CLOCK.now,
        name: "Memória",
      });
      index.removeWin({
        giveawayType: "chat",
        giveawayId: "so-memoria",
        index: 0,
      });
      index.applySoftDelete("chat", {
        id: "chat-apagado",
        deletedAt: "2026-10-01T00:00:00.000Z",
        participants: [],
        participation: { v: 9 },
        winners: [
          {
            id: "soft-user",
            name: "Soft",
            twitchId: "soft-user",
            avatar: "s.png",
            drawnAt: "2026-10-02T15:00:00.000Z",
          },
        ],
      });
    } finally {
      IDBDatabase.prototype.transaction = original;
    }

    const dbAfter = await snapshotDatabase();
    expect(dbBefore.version).toBe(12);
    expect(dbAfter.version).toBe(12);
    expect(dbAfter.name).toBe("stream-drops-db");
    expect(dbAfter.body).toBe(dbBefore.body);
    expect(JSON.parse(dbBefore.body)["chat-participants"].length).toBe(2);
    expect(modes.length).toBeGreaterThan(0);
    expect(modes.every((mode) => mode === "readonly")).toBe(true);
    expect(snapshotStorage()).toEqual(storageBefore);
    expect(storageBefore.local.some(([key]) => key === "stream-drops-settings")).toBe(
      false,
    );
  });
});

describe("atualização incremental", () => {
  const ana = "twitch:ana";

  function chatWinner(
    userId: string,
    name: string,
    drawnAt: string,
    context?: { subscriptionMonths: number; tier: string },
  ) {
    return {
      id: userId,
      name,
      twitchId: userId,
      avatar: `${userId}.png`,
      drawnAt,
      ...(context ? { context } : {}),
    };
  }

  it("insertWin entra na ordem total e ignora unknown", () => {
    const first = {
      userKey: ana,
      platform: "twitch",
      userId: "ana",
      giveawayType: "chat" as const,
      giveawayId: "g1",
      index: 0,
      wonAt: "2026-10-01T15:00:00.000Z",
      name: "Ana",
    };
    const third = {
      ...first,
      giveawayId: "g3",
      wonAt: "2026-10-07T15:00:00.000Z",
    };
    const index = createWinnerIndex([first, third]);
    const kept = index.getWins().map((win) => win);
    index.insertWin({
      ...first,
      giveawayId: "g2",
      wonAt: "2026-10-04T15:00:00.000Z",
    });
    index.insertWin({
      ...first,
      userId: "unknown",
      userKey: "twitch:unknown",
      giveawayId: "g-unknown",
    });
    expect(index.byUser.get(ana)?.map((win) => win.giveawayId)).toEqual([
      "g1",
      "g2",
      "g3",
    ]);
    expect(index.getWins().filter((win) => win.giveawayId !== "g2")).toEqual(
      kept,
    );
    kept.forEach((win, position) => {
      expect(index.getWins().filter((item) => item.giveawayId !== "g2")[position]).toBe(
        win,
      );
    });
  });

  it("removeWin reindexa o array como o filter do sorteio", () => {
    const record = {
      id: "c1",
      winners: [
        chatWinner("ana", "Ana", "2026-10-01T15:00:00.000Z"),
        chatWinner("bia", "Bia", "2026-10-02T15:00:00.000Z"),
      ],
    };
    const other = {
      id: "p1",
      winners: [
        {
          id: "w",
          userId: "ana",
          name: "Ana",
          avatar: "a.png",
          redemptionId: "r",
          drawnAt: "2026-10-07T15:00:00.000Z",
        },
      ],
    };
    const source: WinnerHistorySource = {
      chat: [record],
      channelPoints: [other],
    };
    const index = createWinnerIndexFromSource(source);
    const untouched = index.getWins().find((win) => win.giveawayId === "p1");
    index.removeWin({ giveawayType: "chat", giveawayId: "c1", index: 0 });
    record.winners = record.winners.filter((winner) => winner.twitchId !== "ana");
    expectSameHistory(index, source);
    expect(untouched && index.getWins().includes(untouched)).toBe(true);
    expect(index.getWins().find((win) => win.userId === "bia")?.index).toBe(0);
  });

  it("confirmar, remover e soft-delete igualam remontar do zero", () => {
    const c1 = {
      id: "c1",
      title: "Chat",
      participants: [
        {
          id: "ana",
          name: "ana",
          displayName: "Ana",
          avatar: "a.png",
          subscriber: true,
          subscriptionMonths: 24,
          tier: 3000,
          joinedAt: 1_700_000_000_000,
        },
      ],
      winners: [
        chatWinner("ana", "Ana", "2026-10-01T15:00:00.000Z"),
        chatWinner("bia", "Bia", "2026-10-02T15:00:00.000Z", {
          subscriptionMonths: 12,
          tier: "2000",
        }),
      ],
    };
    const p1 = {
      id: "p1",
      allowMultipleWins: true,
      winners: [
        {
          id: "w-ana",
          userId: "ana",
          name: "Ana",
          avatar: "a.png",
          redemptionId: "r",
          drawnAt: "2026-10-07T15:00:00.000Z",
        },
      ],
    };
    const s1 = {
      id: "s1",
      winners: [subscriber("ana", { is_gift: true, name: "Ana" })],
    };
    const chatRows = [c1];
    const channelRows = [p1];
    const subRows = [s1];
    const source = (): WinnerHistorySource => ({
      chat: chatRows,
      channelPoints: channelRows,
      subscribers: subRows,
    });

    const index = createWinnerIndexFromSource(source());
    expect(
      index.getWins().find((win) => win.giveawayId === "c1" && win.userId === "ana")
        ?.context,
    ).toEqual({ subscriptionMonths: 24, tier: "3000" });

    const c2 = {
      id: "c2",
      winners: [chatWinner("ana", "Ana", "2026-10-04T15:00:00.000Z")],
    };
    chatRows.push(c2);
    index.confirmGiveaway("chat", c2);
    expect(index.byUser.get(ana)?.map((win) => win.giveawayId)).toEqual([
      "s1",
      "c1",
      "c2",
      "p1",
    ]);
    expectSameHistory(index, source());
    const pointsWin = index.getWins().find((win) => win.giveawayId === "p1");
    const middleWin = index.getWins().find((win) => win.giveawayId === "c2");

    s1.winners = [
      subscriber("novo", {
        drawnAt: "2026-10-03T15:00:00.000Z",
        name: "Novo",
      }),
      ...s1.winners,
    ];
    index.confirmGiveaway("subscribers", s1);
    expect(
      index.getWins().find((win) => win.userId === "ana" && win.giveawayId === "s1")
        ?.index,
    ).toBe(1);
    expect(
      index.getWins().find((win) => win.userId === "novo")?.index,
    ).toBe(0);
    expectSameHistory(index, source());

    const pruned = {
      ...c1,
      deletedAt: "2026-10-08T00:00:00.000Z",
      participants: [],
      participation: { v: 2, users: "nope" },
    };
    chatRows[0] = pruned;
    index.applySoftDelete("chat", pruned);
    const anaChat = index
      .getWins()
      .find((win) => win.giveawayId === "c1" && win.userId === "ana");
    const biaChat = index.getWins().find((win) => win.userId === "bia");
    expect(anaChat?.context).toBeUndefined();
    expect(biaChat?.context).toEqual({
      subscriptionMonths: 12,
      tier: "2000",
    });
    expectSameHistory(index, source());

    const withoutBia = {
      ...pruned,
      winners: pruned.winners.filter((winner) => winner.twitchId !== "bia"),
    };
    chatRows[0] = withoutBia;
    index.removeGiveawayWinner("chat", withoutBia);
    expect(index.getWins().some((win) => win.userId === "bia")).toBe(false);
    expect(
      index.getWins().find((win) => win.giveawayId === "c1")?.index,
    ).toBe(0);
    expectSameHistory(index, source());

    expect(index.getWins().includes(pointsWin as WinEvent)).toBe(true);
    expect(index.getWins().includes(middleWin as WinEvent)).toBe(true);
  });

  it("hard delete tira só as vitórias daquele sorteio", () => {
    const chatRecord = {
      id: "c1",
      winners: [chatWinner("ana", "Ana", "2026-10-01T15:00:00.000Z")],
    };
    const pointsRecord = {
      id: "p1",
      winners: [
        {
          id: "w",
          userId: "ana",
          name: "Ana",
          avatar: "a.png",
          redemptionId: "r",
          drawnAt: "2026-10-07T15:00:00.000Z",
        },
      ],
    };
    const index = createWinnerIndexFromSource({
      chat: [chatRecord],
      channelPoints: [pointsRecord],
    });
    const kept = index.getWins().find((win) => win.giveawayId === "p1");
    index.applyHardDelete("chat", "c1");
    expect(index.getWins().some((win) => win.giveawayId === "c1")).toBe(false);
    expect(kept && index.getWins().includes(kept)).toBe(true);
    expectSameHistory(index, { channelPoints: [pointsRecord] });
  });
});

describe("prontidão do índice", () => {
  const pending: WinEvent = {
    userKey: "twitch:novo",
    platform: "twitch",
    userId: "novo",
    giveawayType: "chat" as GiveawayType,
    giveawayId: "preview",
    index: 0,
    wonAt: CLOCK.now,
    name: "Novo",
    preview: true,
  };

  beforeEach(() => {
    resetWinnerIndexSession();
  });

  afterEach(() => {
    resetWinnerIndexSession();
  });

  it("sem índice pronto a leitura não chama o motor", () => {
    const provider = {
      getWins() {
        throw new Error("cedo demais");
      },
    };
    expect(readCardBadges("loading", provider, pending, CLOCK).card).toEqual([]);
    expect(readCardBadges("error", provider, pending, CLOCK).tooltip).toEqual([]);
    expect(readCardBadges("error", provider, pending, CLOCK).highlight).toBeNull();
  });

  it("CA25: atraso simulado entrega o card sem selos e os selos entram depois", async () => {
    startWinnerIndex({
      delayMs: 250,
      read: async () => ({}),
    });
    const { result } = renderHook(() => useCardBadges(pending, CLOCK));
    expect(result.current.status).toBe("loading");
    expect(result.current.selection.card).toEqual([]);
    expect(result.current.selection.tooltip).toEqual([]);
    expect(result.current.selection.highlight).toBeNull();

    await waitFor(
      () => {
        expect(result.current.status).toBe("ready");
      },
      { timeout: 2_000 },
    );
    expect(result.current.selection.tooltip.map((badge) => badge.id)).toContain(
      "first_drop",
    );
  });

  it("erro de leitura também deixa o card sem selos", async () => {
    startWinnerIndex({
      read: async () => {
        throw new Error("falhou");
      },
    });
    const { result } = renderHook(() => useCardBadges(pending, CLOCK));
    await waitFor(
      () => {
        expect(result.current.status).toBe("error");
      },
      { timeout: 2_000 },
    );
    expect(result.current.selection.card).toEqual([]);
    expect(useWinnerIndexStore.getState().index).toBeNull();
  });

  it("falha na carga, o card tenta de novo e os selos entram sem lançar", async () => {
    let reads = 0;
    startWinnerIndex({
      read: async () => {
        reads += 1;
        if (reads === 1) throw new Error("indisponível");
        return {};
      },
    });
    const { result } = renderHook(() => useCardBadges(pending, CLOCK));
    expect(result.current.selection.card).toEqual([]);
    expect(result.current.selection.tooltip).toEqual([]);

    await waitFor(
      () => {
        expect(result.current.status).toBe("ready");
      },
      { timeout: 2_000 },
    );
    expect(reads).toBe(2);
    expect(result.current.selection.tooltip.map((badge) => badge.id)).toContain(
      "first_drop",
    );
    expect(useWinnerIndexStore.getState().error).toBeNull();
  });

  it("esgota as tentativas e não relê o banco", async () => {
    let reads = 0;
    startWinnerIndex({
      read: async () => {
        reads += 1;
        throw new Error("indisponível");
      },
    });
    const { result } = renderHook(() => useCardBadges(pending, CLOCK));
    await waitFor(
      () => {
        expect(reads).toBe(3);
        expect(result.current.status).toBe("error");
      },
      { timeout: 2_000 },
    );
    await new Promise<void>((resolve) => {
      setTimeout(resolve, 700);
    });
    expect(reads).toBe(3);
    expect(result.current.status).toBe("error");
    expect(result.current.selection.card).toEqual([]);
    expect(result.current.selection.tooltip).toEqual([]);
    expect(result.current.selection.highlight).toBeNull();
    expect(useWinnerIndexStore.getState().index).toBeNull();
  });

  it("a sessão monta o índice uma vez", async () => {
    let reads = 0;
    startWinnerIndex({
      read: async () => {
        reads += 1;
        return {};
      },
    });
    startWinnerIndex({
      read: async () => {
        reads += 1;
        return {
          chat: [
            {
              id: "nao-deve",
              winners: [
                {
                  twitchId: "42",
                  name: "Ana",
                  avatar: "a.png",
                  drawnAt: CLOCK.now,
                },
              ],
            },
          ],
        };
      },
    });
    await waitFor(
      () => {
        expect(useWinnerIndexStore.getState().status).toBe("ready");
      },
      { timeout: 2_000 },
    );
    expect(reads).toBe(1);
    expect(useWinnerIndexStore.getState().index?.getWins()).toEqual([]);
  });
});
