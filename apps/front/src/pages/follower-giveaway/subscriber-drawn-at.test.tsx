import type { ReactNode } from "react";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter, Route, Routes } from "react-router";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import "@/i18n";
import i18n from "@/i18n/i18n";
import {
  clearDatabase,
  DATABASE_VERSION,
  openDb,
} from "@/database";
import {
  mergeSubscriberGiveawayUpdate,
  useSubscriptionGiveawayDb,
  type FollowerGiveawayFormData,
  type SubscriberGiveawayWinner,
} from "@/database/SubscriptionGiveaway";
import {
  useChatGiveawayDb,
  type ChatGiveawayFormData,
  type ChatGiveawayWinner,
} from "@/database/ChatGiveaway";
import type { BroadcasterSubscriber } from "@/service/twitch/types";
import type { ChatParticipant } from "@/pages/chat-giveaway/types";
import {
  setChatListenerTestOverrides,
  type ChatListenerClient,
} from "@/pages/chat-giveaway/hooks/use-chat-listener";
import { FollowerGiveaway } from "./index";
import { FollowerGiveawayId } from "./[id]";
import { ChatGiveawayDetail } from "@/pages/chat-giveaway/[id]";
import {
  buildWinnerIndexFromDatabase,
  computeMomentBadges,
  computeStats,
  type EngineClock,
} from "@/lib/winner-badges";

vi.mock("@/service/chat-giveaway", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/service/chat-giveaway")>();
  return {
    ...actual,
    drawWinner: (params: {
      participants: ChatParticipant[];
      excludeIds?: string[];
    }) => {
      const excluded = new Set(params.excludeIds ?? []);
      return (
        params.participants.find((item) => !excluded.has(item.id)) ?? null
      );
    },
  };
});

vi.mock("@/hooks/use-twitch-api", () => ({
  useTwitchApi: () => ({
    userData: {
      id: "broadcaster-1",
      login: "streamer",
      displayName: "Streamer",
      profileImageUrl: "",
      expiresIn: 3600,
      broadcasterType: "partner",
      scopes: [],
    },
    twitchApiClient: {
      sendChatMessage: async () => ({
        isOk: () => true,
        isErr: () => false,
      }),
      fetchSubscriptionsByUserIds: async () => ({
        isOk: () => true,
        isErr: () => false,
        value: new Map(),
      }),
      fetchUsersByIds: async () => ({
        isOk: () => true,
        isErr: () => false,
        value: new Map(),
      }),
      getUsers: async () => ({ isOk: () => false, isErr: () => true }),
    },
    isTokenValid: true,
    getUserByLogin: async () => ({ isOk: () => false, isErr: () => true }),
    isLoading: false,
    isError: false,
    error: null,
    invalidateUserData: () => undefined,
  }),
}));

const CLOCK: EngineClock = {
  now: "2026-10-08T18:00:00.000Z",
  timeZone: "America/Sao_Paulo",
};
const NOW = "2026-10-08T12:00:00.000Z";

/* eslint-disable react-hooks/rules-of-hooks */
const { addGiveaway, getGiveaway, updateGiveaway } = useSubscriptionGiveawayDb();
const { getChatGiveaway } = useChatGiveawayDb();
/* eslint-enable react-hooks/rules-of-hooks */

function subscriber(
  userId: string,
  name: string,
  gift = false,
): BroadcasterSubscriber {
  return {
    broadcaster_id: "broadcaster-1",
    broadcaster_login: "streamer",
    broadcaster_name: "Streamer",
    gifter_id: gift ? "gifter-1" : "",
    gifter_login: gift ? "gifter" : "",
    is_gift: gift,
    plan_name: "Tier 1",
    tier: "1000",
    user_id: userId,
    user_name: name,
    user_login: userId,
  };
}

const legacyWinner = subscriber("legacy-user", "Legado Sub", true);
const nextParticipant = subscriber("novo-user", "Novo Sub");

const legacyGiveaway = {
  id: "sub-legado",
  title: "Sorteio legado",
  description: "antigo",
  subscriptionRequirement: 1000,
  subscriberMultiplier: { "1000": 1, "2000": 2, "3000": 3 },
  participants: [legacyWinner, nextParticipant],
  winners: [legacyWinner],
  spreadsheetUrl: null,
  note: "nao-apagar",
};

const untouchedGiveaway = {
  id: "sub-intocado",
  title: "Sorteio intocado",
  description: "fica",
  subscriptionRequirement: 1000,
  subscriberMultiplier: { "1000": 1, "2000": 1, "3000": 1 },
  participants: [],
  winners: [subscriber("other-user", "Outro")],
  spreadsheetUrl: "https://docs.google.com/spreadsheets/d/abc/edit",
};

function person(
  id: string,
  displayName: string,
  extra: Partial<ChatParticipant> = {},
): ChatParticipant {
  return {
    id,
    name: id,
    displayName,
    avatar: "https://example.com/a.png",
    subscriber: false,
    joinedAt: 1,
    ...extra,
  };
}

function chatGiveaway(
  id: string,
  title: string,
  participants: ChatParticipant[],
  winners: ChatGiveawayWinner[],
): ChatGiveawayFormData {
  return {
    id,
    title,
    description: "",
    keyword: "!join",
    cost: 0,
    minimumSuscriptionTimeInMonths: 0,
    subscriberMultiplier: 1,
    subscribersOnly: false,
    winners,
    participants,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
  };
}

const oldChatWinner: ChatGiveawayWinner = {
  id: "old-viewer",
  name: "Antigo",
  twitchId: "old-viewer",
  avatar: "https://example.com/old.png",
  drawnAt: "2026-03-01T00:00:00.000Z",
};

const loyal = person("fiel", "Fiel", {
  subscriber: true,
  subscriptionMonths: 24,
  tier: 3000,
  joinedAt: 10,
});
const monthsOnly = person("meses", "So Meses", {
  subscriber: true,
  subscriptionMonths: 12,
  tier: null,
  joinedAt: 20,
});
const plain = person("plano", "Plano", { joinedAt: 30 });

const chatLegacy = chatGiveaway(
  "chat-fiel-legado",
  "Chat legado",
  [
    person("4", "Fiel Legado", {
      subscriber: true,
      subscriptionMonths: 24,
      tier: 3000,
      joinedAt: 5,
    }),
  ],
  [
    {
      id: "4",
      name: "Fiel Legado",
      twitchId: "4",
      avatar: "https://example.com/f.png",
      drawnAt: "2026-10-04T15:00:00.000Z",
    },
  ],
);

const chatLive = chatGiveaway(
  "chat-ao-vivo",
  "Chat ao vivo",
  [loyal, monthsOnly, plain],
  [oldChatWinner],
);

function createFakeClient(): ChatListenerClient {
  const listeners = new Map<string, Array<(...args: unknown[]) => void>>();
  return {
    async connect() {
      listeners.get("connected")?.forEach((listener) => listener());
    },
    async disconnect() {
      listeners.get("disconnected")?.forEach((listener) => listener());
    },
    on(event, listener) {
      const list = listeners.get(event) ?? [];
      list.push(listener);
      listeners.set(event, list);
    },
  };
}

async function putStore(name: string, records: unknown[]): Promise<void> {
  const db = await openDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(name, "readwrite");
    const store = tx.objectStore(name);
    for (const record of records) store.put(record);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error);
  });
}

async function seedLegacy(): Promise<void> {
  await putStore("giveaways", [legacyGiveaway, untouchedGiveaway]);
  await putStore("chat-giveaways", [chatLegacy, chatLive]);
  await putStore("channel-points-giveaways", [
    {
      id: "points-legado",
      title: "Pontos",
      winners: [
        {
          id: "w-points",
          userId: "points-user",
          name: "Pontos",
          avatar: "p.png",
          redemptionId: "r1",
          drawnAt: "2026-09-01T00:00:00.000Z",
        },
      ],
    },
  ]);
  await putStore("exclusion-list", [
    {
      twitchUserId: "mod",
      username: "modbot",
      displayName: "Mod",
      profileImageUrl: "",
      updatedAt: "2026-01-01T00:00:00.000Z",
    },
  ]);
}

async function readDatabase(): Promise<{
  version: number;
  names: string[];
  body: string;
}> {
  const db = await openDb();
  const names = [...db.objectStoreNames].sort();
  const stores: Record<string, unknown[]> = {};
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(names, "readonly");
    for (const name of names) {
      const request = tx.objectStore(name).getAll();
      request.onsuccess = () => {
        stores[name] = request.result as unknown[];
      };
    }
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error);
  });
  return {
    version: db.version,
    names,
    body: JSON.stringify(stores),
  };
}

function storageFingerprint() {
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

function renderAt(path: string, element: ReactNode) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[path]}>
        <Routes>
          <Route path="/dashboard/follower-giveaway" element={element} />
          <Route path="/dashboard/follower-giveaway/:id" element={element} />
          <Route path="/dashboard/chat-giveaway/:id" element={element} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

function expectIsoRecent(value: unknown) {
  expect(typeof value).toBe("string");
  expect(value).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
  expect(Math.abs(Date.parse(String(value)) - Date.now())).toBeLessThan(20_000);
}

describe("merge de Subscribers", () => {
  const base = legacyGiveaway as unknown as FollowerGiveawayFormData;
  const fresh = subscriber("novo-user", "Novo Sub") as SubscriberGiveawayWinner;

  it("não backfilla sorteio antigo e carimba só o vencedor novo", () => {
    const merged = mergeSubscriberGiveawayUpdate(
      base,
      { ...base, winners: [fresh, ...base.winners], title: "mudou" },
      NOW,
    );
    expect(merged.winners[0]).toMatchObject({ user_id: "novo-user", drawnAt: NOW });
    expect(merged.winners[1]).toBe(base.winners[0]);
    expect(merged.winners[1]).not.toHaveProperty("drawnAt");
    expect(merged.createdAt).toBeUndefined();
    expect(merged.updatedAt).toBeUndefined();
    expect(merged.participants[0]).not.toHaveProperty("drawnAt");
    expect(merged.title).toBe("mudou");
  });

  it("sorteio novo mantém createdAt e atualiza updatedAt", () => {
    const previous: FollowerGiveawayFormData = {
      ...base,
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-02T00:00:00.000Z",
    };
    const { createdAt: _created, updatedAt: _updated, ...withoutDates } = previous;
    const merged = mergeSubscriberGiveawayUpdate(
      previous,
      { ...withoutDates, title: "renomeado" },
      NOW,
    );
    expect(merged.createdAt).toBe("2026-01-01T00:00:00.000Z");
    expect(merged.updatedAt).toBe(NOW);
    expect(merged.winners[0]).toBe(previous.winners[0]);
  });

  it("preserva drawnAt que o vencedor novo já trouxe", () => {
    const stamped = { ...fresh, drawnAt: "2026-05-01T00:00:00.000Z" };
    const merged = mergeSubscriberGiveawayUpdate(
      base,
      { ...base, winners: [stamped, ...base.winners] },
      NOW,
    );
    expect(merged.winners[0]?.drawnAt).toBe("2026-05-01T00:00:00.000Z");
  });
});

describe("S3 no IndexedDB v12", () => {
  let before: { version: number; names: string[]; body: string };
  let storageBefore: ReturnType<typeof storageFingerprint>;

  beforeEach(async () => {
    await i18n.changeLanguage("pt-BR");
    await clearDatabase();
    setChatListenerTestOverrides({
      createClient: () => createFakeClient(),
      batchMaxWaitMs: 0,
      persistIntervalMs: 60_000,
    });
    await seedLegacy();
    before = await readDatabase();
    storageBefore = storageFingerprint();
  });

  afterEach(() => {
    setChatListenerTestOverrides(null);
    cleanup();
  });

  it("abrir telas, índice e selos não reescreve a fixture v12", async () => {
    const modes: string[] = [];
    const original = IDBDatabase.prototype.transaction;
    IDBDatabase.prototype.transaction = function (
      storeNames: string | Iterable<string>,
      mode?: IDBTransactionMode,
      options?: IDBTransactionOptions,
    ) {
      modes.push(mode ?? "readonly");
      return original.call(this, storeNames, mode, options);
    };

    try {
      const list = renderAt("/dashboard/follower-giveaway", <FollowerGiveaway />);
      expect(await screen.findByText("Sorteio legado")).toBeTruthy();
      expect(screen.getByText("Sorteio intocado")).toBeTruthy();
      list.unmount();

      const detail = renderAt(
        "/dashboard/follower-giveaway/sub-legado",
        <FollowerGiveawayId />,
      );
      expect(
        await screen.findByRole("heading", { name: "Sorteio legado" }),
      ).toBeTruthy();
      expect(await screen.findByText("Total de Vencedores")).toBeTruthy();
      expect(screen.getByText("Lista de Participantes")).toBeTruthy();
      expect(screen.getByText("Lista de Vencedores")).toBeTruthy();
      detail.unmount();

      const chat = renderAt(
        "/dashboard/chat-giveaway/chat-fiel-legado",
        <ChatGiveawayDetail />,
      );
      expect(
        await screen.findByRole("heading", { name: "Chat legado" }),
      ).toBeTruthy();
      await screen.findByText("Conectado");
      chat.unmount();

      const index = await buildWinnerIndexFromDatabase();
      const legacy = index
        .getWins()
        .find((win) => win.userId === "legacy-user");
      expect(legacy?.wonAt).toBeUndefined();
      expect(legacy?.context?.isGift).toBe(true);
      const badges = computeMomentBadges(index, legacy!, CLOCK).map(
        (badge) => badge.id,
      );
      expect(badges).toContain("gifted_sub");
      expect(badges).not.toContain("first_drop");
      const faithful = index.getWins().find((win) => win.userId === "4");
      expect(faithful?.context).toEqual({
        subscriptionMonths: 24,
        tier: "3000",
      });
      expect(
        computeMomentBadges(index, faithful!, CLOCK).some(
          (badge) => badge.id === "loyal_sub" && badge.count === 24,
        ),
      ).toBe(true);
      computeStats(index, CLOCK);
    } finally {
      IDBDatabase.prototype.transaction = original;
    }

    const after = await readDatabase();
    expect(before.version).toBe(DATABASE_VERSION);
    expect(after.version).toBe(12);
    expect(after.names).toEqual(before.names);
    expect(after.names).not.toContain("winner-events");
    expect(after.body).toBe(before.body);
    expect(modes.length).toBeGreaterThan(0);
    expect(modes.every((mode) => mode === "readonly")).toBe(true);
    expect(storageFingerprint()).toEqual(storageBefore);
    expect(storageBefore.local.some(([key]) => key === "stream-drops-settings")).toBe(
      false,
    );
  }, 30_000);

  it("CA-SD2: sortear grava drawnAt em prepend e o legado não muda", async () => {
    renderAt("/dashboard/follower-giveaway/sub-legado", <FollowerGiveawayId />);
    expect(
      await screen.findByRole("heading", { name: "Sorteio legado" }),
    ).toBeTruthy();
    await screen.findByText("Novo Sub");

    fireEvent.click(screen.getByRole("button", { name: "Sortear" }));

    await waitFor(async () => {
      const stored = await getGiveaway("sub-legado");
      expect(stored?.winners).toHaveLength(2);
    });

    const stored = await getGiveaway("sub-legado");
    const winners = stored?.winners ?? [];
    expect(winners[0]?.user_id).toBe("novo-user");
    expectIsoRecent(winners[0]?.drawnAt);
    expect(winners[1]).toEqual(legacyWinner);
    expect(winners[1]).not.toHaveProperty("drawnAt");
    expect(stored).not.toHaveProperty("createdAt");
    expect(stored).not.toHaveProperty("updatedAt");
    expect(stored?.participants.find((item) => item.user_id === "novo-user"))
      .not.toHaveProperty("drawnAt");
    expect((stored as { note?: string } | undefined)?.note).toBe("nao-apagar");

    const winnersCard = screen
      .getByText("Lista de Vencedores")
      .closest("[data-slot=card]");
    expect(winnersCard).toBeTruthy();
    await waitFor(() => {
      const rows = [...(winnersCard?.querySelectorAll("tbody tr") ?? [])];
      expect(rows[0]?.textContent).toContain("Legado Sub");
      expect(rows.at(-1)?.textContent).toContain("Novo Sub");
    });

    const untouched = await getGiveaway("sub-intocado");
    expect(untouched).toEqual(untouchedGiveaway);
    const chatUntouched = await getChatGiveaway("chat-fiel-legado");
    expect(chatUntouched).toEqual(chatLegacy);

    const index = await buildWinnerIndexFromDatabase();
    const dated = index.getWins().find((win) => win.userId === "novo-user");
    const undated = index.getWins().find((win) => win.userId === "legacy-user");
    expect(dated?.wonAt).toBe(winners[0]?.drawnAt);
    expect(dated?.giveawayType).toBe("subscribers");
    expect(undated?.wonAt).toBeUndefined();
    expect(
      computeMomentBadges(index, dated!, CLOCK).map((badge) => badge.id),
    ).toContain("first_drop");
    const onLegacy = computeMomentBadges(index, undated!, CLOCK).map(
      (badge) => badge.id,
    );
    expect(onLegacy).toContain("gifted_sub");
    expect(onLegacy).not.toContain("first_drop");
    expect(onLegacy).not.toContain("streak_daily");
    const viewer = computeStats(index, CLOCK).viewers.find(
      (item) => item.userKey === "twitch:legacy-user",
    );
    expect(viewer?.totals.subscribers).toBe(1);
    expect(viewer?.undatedWins).toBe(1);
    expect(storageFingerprint()).toEqual(storageBefore);
  }, 30_000);

  it("sorteio novo grava createdAt e updatedAt muda quando ele muda", async () => {
    const id = "sub-novo";
    await addGiveaway({
      id,
      title: "Sorteio novo",
      description: "agora",
      subscriptionRequirement: 1000,
      subscriberMultiplier: { "1000": 1, "2000": 1, "3000": 1 },
      participants: [],
      winners: [],
      spreadsheetUrl: null,
    });
    const created = await getGiveaway(id);
    expectIsoRecent(created?.createdAt);
    expect(created?.updatedAt).toBe(created?.createdAt);
    const createdAt = created?.createdAt ?? "";

    while (Date.now() <= Date.parse(createdAt)) {
      await new Promise((resolve) => setTimeout(resolve, 5));
    }

    await updateGiveaway({
      ...(created as FollowerGiveawayFormData),
      title: "Sorteio renomeado",
    });
    const updated = await getGiveaway(id);
    expect(updated?.createdAt).toBe(createdAt);
    expect(Date.parse(updated?.updatedAt ?? "")).toBeGreaterThan(
      Date.parse(createdAt),
    );
    expect(updated?.title).toBe("Sorteio renomeado");
    expect(updated?.winners).toEqual([]);

    const legacy = await getGiveaway("sub-legado");
    await updateGiveaway({
      ...(legacy as FollowerGiveawayFormData),
      description: "continua antigo",
    });
    const stillLegacy = await getGiveaway("sub-legado");
    expect(stillLegacy).not.toHaveProperty("createdAt");
    expect(stillLegacy).not.toHaveProperty("updatedAt");
    expect(stillLegacy?.winners).toEqual([legacyWinner]);
    expect(stillLegacy?.description).toBe("continua antigo");
  });

  it("confirmação do Chat grava context e o vencedor antigo fica igual", async () => {
    renderAt("/dashboard/chat-giveaway/chat-ao-vivo", <ChatGiveawayDetail />);
    expect(
      await screen.findByRole("heading", { name: "Chat ao vivo" }),
    ).toBeTruthy();
    await screen.findByText("Conectado");

    const confirm = async () => {
      await screen.findByRole("button", { name: "Confirmar" }, { timeout: 4000 });
      await waitFor(() => {
        const button = screen.getByRole("button", {
          name: "Confirmar",
        }) as HTMLButtonElement;
        fireEvent.click(button);
        expect(button.disabled).toBe(true);
      });
    };

    fireEvent.click(screen.getByRole("button", { name: /Sortear Vencedor/ }));
    await confirm();
    await waitFor(async () => {
      const stored = await getChatGiveaway("chat-ao-vivo");
      expect(stored?.winners).toHaveLength(2);
    });

    await waitFor(() => {
      expect(screen.queryByRole("button", { name: "Confirmar" })).toBeNull();
    });

    fireEvent.click(screen.getByRole("button", { name: /Sortear Vencedor/ }));
    await confirm();
    await waitFor(async () => {
      const stored = await getChatGiveaway("chat-ao-vivo");
      expect(stored?.winners).toHaveLength(3);
    });
    await waitFor(() => {
      expect(screen.queryByRole("button", { name: "Confirmar" })).toBeNull();
    });

    fireEvent.click(screen.getByRole("button", { name: /Sortear Vencedor/ }));
    await confirm();
    await waitFor(async () => {
      const stored = await getChatGiveaway("chat-ao-vivo");
      expect(stored?.winners).toHaveLength(4);
    });

    const stored = await getChatGiveaway("chat-ao-vivo");
    const winners = stored?.winners ?? [];
    expect(winners[0]).toEqual(oldChatWinner);
    expect(winners[0]).not.toHaveProperty("context");
    expect(winners[1]).toMatchObject({
      twitchId: "fiel",
      context: { subscriptionMonths: 24, tier: 3000 },
    });
    expect(winners[2]).toMatchObject({
      twitchId: "meses",
      context: { subscriptionMonths: 12 },
    });
    expect(winners[2]?.context).not.toHaveProperty("tier");
    expect(winners[3]).toMatchObject({ twitchId: "plano", context: {} });
    expect(winners[3]?.context).not.toHaveProperty("subscriptionMonths");
    expect(
      stored?.participants?.find((item) => item.id === "fiel")?.subscriptionMonths,
    ).toBe(24);
    expect(stored?.participants?.find((item) => item.id === "fiel")).not.toHaveProperty(
      "context",
    );

    const legacyChat = await getChatGiveaway("chat-fiel-legado");
    expect(legacyChat).toEqual(chatLegacy);
    expect(legacyChat?.winners[0]).not.toHaveProperty("context");

    const index = await buildWinnerIndexFromDatabase();
    const fromContext = index.getWins().find(
      (win) => win.giveawayId === "chat-ao-vivo" && win.userId === "fiel",
    );
    const fromJoin = index.getWins().find((win) => win.userId === "4");
    expect(fromContext?.context).toEqual({
      subscriptionMonths: 24,
      tier: "3000",
    });
    expect(
      computeMomentBadges(index, fromContext!, CLOCK).find(
        (badge) => badge.id === "loyal_sub",
      )?.rarity,
    ).toBe("epic");
    expect(fromJoin?.context?.subscriptionMonths).toBe(24);
    expect(
      computeMomentBadges(index, fromJoin!, CLOCK).some(
        (badge) => badge.id === "loyal_sub",
      ),
    ).toBe(true);
    expect(storageFingerprint()).toEqual(storageBefore);
  }, 30_000);
});
