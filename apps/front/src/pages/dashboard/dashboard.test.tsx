import { ThemeProvider } from "@/components/theme-provider";
import { DATABASE_VERSION, clearDatabase, openDb } from "@/database";
import "@/i18n";
import { STORAGE_KEY_STREAM_DROPS_SETTINGS } from "@/storage";
import { useLoginStore } from "@/storage/login";
import { useSettingsStore } from "@/storage/settings";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import axe from "axe-core";
import { MemoryRouter, Route, Routes } from "react-router";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { page } from "vitest/browser";
import { localDateTimeToIso } from "@/lib/winner-badges/datetime";
import type { EngineClock } from "@/lib/winner-badges/types";
import { DashboardPage } from "./index";
import type { DashboardSource } from "./source";
import { ViewerProfilePage } from "./viewer-page";

const TZ = "America/Sao_Paulo";
const LOGIN_SENTINEL = JSON.stringify({
  state: {
    twitchAccessToken: "token-nao-apagar",
    driveCode: "drive-nao-apagar",
    sessionExpired: false,
  },
  version: 0,
});

function iso(
  year: number,
  month: number,
  day: number,
  hour = 12,
  minute = 0,
): string {
  const value = localDateTimeToIso(
    { year, month, day, hour, minute, second: 0 },
    TZ,
  );
  if (!value) throw new Error("data inválida");
  return value;
}

const CLOCK: EngineClock = {
  now: iso(2026, 10, 15),
  timeZone: TZ,
};

function rowKey(row: unknown): string {
  if (!row || typeof row !== "object") return "";
  const record = row as Record<string, unknown>;
  return String(record.id ?? record.twitchUserId ?? record.username ?? "");
}

async function putRaw(storeName: string, records: unknown[]) {
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

async function dumpDatabase() {
  const db = await openDb();
  const names = [...db.objectStoreNames].sort();
  const stores: Record<string, unknown[]> = {};
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(names, "readonly");
    for (const name of names) {
      const request = tx.objectStore(name).getAll();
      request.onsuccess = () => {
        stores[name] = [...(request.result as unknown[])].sort((left, right) =>
          rowKey(left).localeCompare(rowKey(right)),
        );
      };
    }
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error);
  });
  return { version: db.version, names, body: JSON.stringify(stores) };
}

function storageSnapshot() {
  return {
    local: Object.keys(localStorage)
      .sort()
      .map((key) => [key, localStorage.getItem(key)] as const),
    session: Object.keys(sessionStorage)
      .sort()
      .map((key) => [key, sessionStorage.getItem(key)] as const),
    cookie: document.cookie,
  };
}

function installSpies() {
  const storageWrites: string[] = [];
  const idbWrites: string[] = [];
  const readwrite: string[] = [];
  const originalSet = Storage.prototype.setItem;
  const originalRemove = Storage.prototype.removeItem;
  const originalClear = Storage.prototype.clear;
  const originalTransaction = IDBDatabase.prototype.transaction;
  const originalPut = IDBObjectStore.prototype.put;
  const originalAdd = IDBObjectStore.prototype.add;
  const originalDelete = IDBObjectStore.prototype.delete;

  Storage.prototype.setItem = function (key: string, value: string) {
    const area = this === sessionStorage ? "session" : "local";
    storageWrites.push(`set:${area}:${key}`);
    return originalSet.call(this, key, value);
  };
  Storage.prototype.removeItem = function (key: string) {
    const area = this === sessionStorage ? "session" : "local";
    storageWrites.push(`remove:${area}:${key}`);
    return originalRemove.call(this, key);
  };
  Storage.prototype.clear = function () {
    storageWrites.push("clear");
    return originalClear.call(this);
  };
  IDBDatabase.prototype.transaction = function (
    storeNames: string | Iterable<string>,
    mode?: IDBTransactionMode,
    options?: IDBTransactionOptions,
  ) {
    const tx = originalTransaction.call(this, storeNames, mode, options);
    if ((mode ?? "readonly") === "readwrite") {
      const names = typeof storeNames === "string" ? [storeNames] : [...storeNames];
      readwrite.push(names.join(","));
    }
    return tx;
  };
  const track = (op: string, original: typeof originalPut) =>
    function (this: IDBObjectStore, ...args: [unknown, ...unknown[]]) {
      idbWrites.push(`${op}:${this.name}`);
      return original.apply(this, args as never);
    };
  IDBObjectStore.prototype.put = track("put", originalPut) as IDBObjectStore["put"];
  IDBObjectStore.prototype.add = track("add", originalAdd) as IDBObjectStore["add"];
  IDBObjectStore.prototype.delete = track(
    "delete",
    originalDelete,
  ) as IDBObjectStore["delete"];

  return {
    storageWrites,
    idbWrites,
    readwrite,
    restore() {
      Storage.prototype.setItem = originalSet;
      Storage.prototype.removeItem = originalRemove;
      Storage.prototype.clear = originalClear;
      IDBDatabase.prototype.transaction = originalTransaction;
      IDBObjectStore.prototype.put = originalPut;
      IDBObjectStore.prototype.add = originalAdd;
      IDBObjectStore.prototype.delete = originalDelete;
    },
  };
}

function emptySource(): DashboardSource {
  return { chat: [], channelPoints: [], subscribers: [], excludedUserIds: [] };
}

function chatGiveaway(
  id: string,
  title: string,
  twitchId: string,
  name: string,
  drawnAt: string,
  extra: Record<string, unknown> = {},
) {
  return {
    id,
    title,
    description: "legado",
    keyword: "!join",
    cost: 0,
    minimumSuscriptionTimeInMonths: 0,
    subscriberMultiplier: 1,
    subscribersOnly: false,
    winners: [{ id: twitchId, name, twitchId, avatar: "", drawnAt }],
    participants: [{ id: twitchId, name, displayName: name }],
    createdAt: iso(2026, 10, 1, 9),
    updatedAt: iso(2026, 10, 1, 9),
    legacyMarker: "fica",
    ...extra,
  };
}

function renderDashboard(options: {
  clock?: EngineClock;
  broadcasterId?: string;
  loadSource?: () => Promise<DashboardSource>;
  path?: string;
}) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  const clock = options.clock ?? CLOCK;
  const loadSource = options.loadSource;
  return render(
    <QueryClientProvider client={client}>
      <ThemeProvider defaultTheme="dark" storageKey="vite-ui-theme">
        <MemoryRouter initialEntries={[options.path ?? "/dashboard"]}>
          <Routes>
            <Route
              path="/dashboard"
              element={
                <DashboardPage
                  clock={clock}
                  broadcasterId={options.broadcasterId}
                  loadSource={loadSource}
                />
              }
            />
            <Route
              path="/dashboard/viewer/:platform/:userId"
              element={
                <ViewerProfilePage clock={clock} loadSource={loadSource} />
              }
            />
          </Routes>
        </MemoryRouter>
      </ThemeProvider>
    </QueryClientProvider>,
  );
}

function summaryValue(id: string): string {
  const card = document.querySelector(`[data-summary="${id}"]`);
  return card?.querySelector("p:last-of-type")?.textContent?.trim() ?? "";
}

async function databasesNamed() {
  const databases = await indexedDB.databases();
  return databases.map((database) => database.name);
}

describe("Dashboard v1", () => {
  beforeEach(async () => {
    await page.viewport(1280, 800);
    await clearDatabase();
    useLoginStore.setState({
      twitchAccessToken: null,
      driveCode: null,
      sessionExpired: false,
    });
    useSettingsStore.setState({ badges: { enabled: true } });
    localStorage.setItem("vite-ui-theme", "dark");
    localStorage.setItem("login-storage", LOGIN_SENTINEL);
    localStorage.setItem("sd-dashboard-canary", "fica");
    localStorage.removeItem(STORAGE_KEY_STREAM_DROPS_SETTINGS);
    sessionStorage.setItem("sd-dashboard-session", "fica");
    document.cookie = "sd_dashboard=1; path=/";
    await useSettingsStore.persist.rehydrate();
  });

  afterEach(async () => {
    cleanup();
    useSettingsStore.setState({ badges: { enabled: true } });
    localStorage.removeItem(STORAGE_KEY_STREAM_DROPS_SETTINGS);
    localStorage.removeItem("login-storage");
    localStorage.removeItem("vite-ui-theme");
    localStorage.removeItem("sd-dashboard-canary");
    sessionStorage.removeItem("sd-dashboard-session");
    document.cookie = "sd_dashboard=; path=/; max-age=0";
    useLoginStore.setState({
      twitchAccessToken: null,
      driveCode: null,
      sessionExpired: false,
    });
    await clearDatabase();
  });

  it("banco ausente não é criado ao abrir", async () => {
    expect(await databasesNamed()).not.toContain("stream-drops-db");
    const storageBefore = storageSnapshot();
    const spy = installSpies();
    try {
      renderDashboard({});
      expect(
        await screen.findByRole("heading", { name: "Crie seu primeiro sorteio" }),
      ).toBeTruthy();
    } finally {
      spy.restore();
    }
    expect(spy.storageWrites).toEqual([]);
    expect(spy.idbWrites).toEqual([]);
    expect(spy.readwrite).toEqual([]);
    expect(await databasesNamed()).not.toContain("stream-drops-db");
    expect(storageSnapshot()).toEqual(storageBefore);
    expect(DATABASE_VERSION).toBe(12);
  }, 30_000);

  it("CA-D7 e CA-D12: abrir e trocar o período não reescreve a v12", async () => {
    await putRaw("chat-giveaways", [
      chatGiveaway("chat-legado", "Chat legado", "ana", "Ana", iso(2026, 10, 4)),
    ]);
    await putRaw("exclusion-list", [
      {
        twitchUserId: "100",
        username: "nightbot",
        displayName: "Nightbot",
        profileImageUrl: "",
        updatedAt: "2026-01-01T00:00:00.000Z",
      },
    ]);
    await putRaw("roulettes", [{ id: "roleta-1", title: "Roleta", options: ["A"] }]);
    const dbBefore = await dumpDatabase();
    const storageBefore = storageSnapshot();
    const spy = installSpies();
    try {
      renderDashboard({});
      expect((await screen.findAllByText("Ana")).length).toBeGreaterThan(0);
      expect(spy.storageWrites).toEqual([]);
      expect(spy.idbWrites).toEqual([]);
      expect(spy.readwrite).toEqual([]);
      fireEvent.click(screen.getByRole("button", { name: "Geral" }));
      expect(
        await screen.findByRole("button", { name: "Geral", pressed: true }),
      ).toBeTruthy();
    } finally {
      spy.restore();
    }
    const dbAfter = await dumpDatabase();
    expect(dbBefore.version).toBe(12);
    expect(dbAfter.version).toBe(12);
    expect(dbAfter.body).toBe(dbBefore.body);
    expect(spy.idbWrites).toEqual([]);
    expect(spy.readwrite).toEqual([]);
    const raw = localStorage.getItem(STORAGE_KEY_STREAM_DROPS_SETTINGS) ?? "";
    expect(raw).toContain('"period":"all"');
    expect(raw).toContain('"version":1');
    const withoutSettings = {
      ...storageBefore,
      local: storageBefore.local.filter(
        ([key]) => key !== STORAGE_KEY_STREAM_DROPS_SETTINGS,
      ),
    };
    const after = storageSnapshot();
    expect({
      ...after,
      local: after.local.filter(
        ([key]) => key !== STORAGE_KEY_STREAM_DROPS_SETTINGS,
      ),
    }).toEqual(withoutSettings);
    expect(localStorage.getItem("login-storage")).toBe(LOGIN_SENTINEL);
    expect(localStorage.getItem("sd-dashboard-canary")).toBe("fica");

    cleanup();
    renderDashboard({});
    expect(
      await screen.findByRole("button", { name: "Geral", pressed: true }),
    ).toBeTruthy();
    const dbLater = await dumpDatabase();
    expect(dbLater.body).toBe(dbBefore.body);
  }, 30_000);

  it("CA-D46: tipo desconhecido e versão estranha ficam no disco", async () => {
    const kick = JSON.stringify({
      state: {
        badges: { enabled: true },
        dashboard: {
          period: "month",
          type: "kick",
          dismissLocalHistory: false,
          dismissChatLegacy: false,
        },
      },
      version: 1,
    });
    localStorage.setItem(STORAGE_KEY_STREAM_DROPS_SETTINGS, kick);
    await useSettingsStore.persist.rehydrate();
    renderDashboard({ loadSource: async () => emptySource() });
    expect(
      await screen.findByRole("heading", { name: "Crie seu primeiro sorteio" }),
    ).toBeTruthy();
    expect(
      screen.getByRole("button", { name: "Todos" }).getAttribute("aria-pressed"),
    ).toBe("true");
    expect(localStorage.getItem(STORAGE_KEY_STREAM_DROPS_SETTINGS)).toBe(kick);

    cleanup();
    const strange = JSON.stringify({
      state: { badges: { enabled: false }, dashboard: { type: "chat" } },
      version: 99,
    });
    localStorage.setItem(STORAGE_KEY_STREAM_DROPS_SETTINGS, strange);
    await useSettingsStore.persist.rehydrate();
    renderDashboard({ loadSource: async () => emptySource() });
    expect(
      await screen.findByRole("button", { name: "Este mês", pressed: true }),
    ).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Geral" }));
    expect(localStorage.getItem(STORAGE_KEY_STREAM_DROPS_SETTINGS)).toBe(strange);
  }, 30_000);

  it("CA-D22: o esqueleto deixa a navegação usável", async () => {
    let resolveLoad: (value: DashboardSource) => void = () => {};
    const pending = new Promise<DashboardSource>((resolve) => {
      resolveLoad = resolve;
    });
    renderDashboard({ loadSource: () => pending });
    expect(document.querySelector("[data-dashboard-status='loading']")).toBeTruthy();
    expect(document.querySelector("[aria-busy='true']")).toBeTruthy();
    expect(screen.getByRole("link", { name: "Configurações" })).toBeTruthy();
    expect(screen.getByRole("link", { name: "Início" })).toBeTruthy();
    resolveLoad(emptySource());
    expect(
      await screen.findByRole("heading", { name: "Crie seu primeiro sorteio" }),
    ).toBeTruthy();
    expect(document.querySelector("[aria-busy='true']")).toBeNull();
  }, 30_000);

  it("CA-D23: os avisos ficam até a dispensa explícita", async () => {
    renderDashboard({ loadSource: async () => emptySource() });
    expect(
      await screen.findByText("Histórico salvo só neste navegador."),
    ).toBeTruthy();
    expect(screen.getByText(/Participações e secas/)).toBeTruthy();
    const dismiss = screen.getAllByRole("button", { name: "Não mostrar de novo" });
    expect(dismiss).toHaveLength(2);
    fireEvent.click(dismiss[0]);
    await waitFor(() => {
      expect(screen.queryByText("Histórico salvo só neste navegador.")).toBeNull();
    });
    expect(screen.getByText(/Participações e secas/)).toBeTruthy();
    const raw = localStorage.getItem(STORAGE_KEY_STREAM_DROPS_SETTINGS) ?? "";
    expect(raw).toContain('"dismissLocalHistory":true');
    expect(raw).toContain('"dismissChatLegacy":false');
  }, 30_000);

  it("CA-D24: o vazio aponta para os três sorteios", async () => {
    renderDashboard({ loadSource: async () => emptySource() });
    expect(
      await screen.findByRole("heading", { name: "Crie seu primeiro sorteio" }),
    ).toBeTruthy();
    expect(screen.getByRole("link", { name: "Chat" }).getAttribute("href")).toBe(
      "/dashboard/chat-giveaway/create",
    );
    const points = screen.getAllByRole("link", { name: "Pontos do Canal" });
    expect(
      points.some(
        (link) =>
          link.getAttribute("href") === "/dashboard/channel-points-giveaway/create",
      ),
    ).toBe(true);
    expect(
      screen.getByRole("link", { name: "Subscribers" }).getAttribute("href"),
    ).toBe("/dashboard/follower-giveaway/create");
  }, 30_000);

  it("CA-D39 e CA-D41: pódio só no top e sem Ver todos", async () => {
    const chat = Array.from({ length: 10 }, (_, index) => {
      const day = 14 - index;
      const id = `u${index}`;
      return chatGiveaway(id, `Sorteio ${id}`, id, `Viewer ${index}`, iso(2026, 10, day));
    });
    renderDashboard({
      loadSource: async () => ({
        chat,
        channelPoints: [],
        subscribers: [],
        excludedUserIds: [],
      }),
    });
    expect((await screen.findAllByText("Viewer 0")).length).toBeGreaterThan(0);
    const root = document.querySelector("[data-dashboard-root]");
    expect(root?.querySelectorAll("[data-podium]")).toHaveLength(3);
    expect(
      root?.querySelectorAll("[data-block='top-winners'] [data-podium]"),
    ).toHaveLength(3);
    expect(
      root?.querySelectorAll("[data-block='recent-winners'] [data-podium]"),
    ).toHaveLength(0);
    expect(
      root?.querySelectorAll("[data-block='recent-achievements'] [data-podium]"),
    ).toHaveLength(0);
    expect(root?.querySelectorAll("[data-rank]")).toHaveLength(7);
    expect(document.body.textContent ?? "").not.toMatch(/ver todos/i);
    expect(screen.getAllByText("Pelo histórico deste navegador.").length).toBeGreaterThanOrEqual(
      3,
    );
    expect(screen.getByRole("columnheader", { name: "Vitórias" })).toBeTruthy();
  }, 30_000);

  it("feed, filtro, perfil, selos e axe", async () => {
    const data: DashboardSource = {
      chat: [
        chatGiveaway("bia", "Sorteio Bia", "bia", "Bia", iso(2026, 10, 14)),
        chatGiveaway("cai", "Sorteio Cai", "cai", "Cai", iso(2026, 10, 12), {
          deletedAt: iso(2026, 10, 13),
        }),
        chatGiveaway("ana", "Sorteio Ana", "ana", "Ana", iso(2026, 10, 10)),
        {
          ...chatGiveaway("anon", "Sorteio Anon", "anon", "Anon", iso(2026, 10, 8)),
          winners: [
            {
              id: "anon",
              name: "Anon",
              twitchId: "unknown",
              avatar: "",
              drawnAt: iso(2026, 10, 8),
            },
          ],
        },
        chatGiveaway("mod", "Sorteio Mod", "mod", "NightMod", iso(2026, 10, 13)),
        chatGiveaway("caster", "Sorteio Caster", "caster", "OCaster", iso(2026, 10, 11)),
      ],
      channelPoints: [],
      subscribers: [
        {
          id: "sub-1",
          title: "Sorteio Sub",
          description: "",
          subscriptionRequirement: 1000,
          subscriberMultiplier: { "1000": 1, "2000": 2, "3000": 3 },
          participants: [],
          winners: [
            {
              user_id: "sub",
              user_name: "SubZero",
              user_login: "subzero",
              tier: "1000",
              drawnAt: iso(2026, 10, 6),
            },
          ],
          createdAt: iso(2026, 10, 2),
        },
      ],
      excludedUserIds: ["mod"],
    };
    renderDashboard({
      broadcasterId: "caster",
      loadSource: async () => data,
    });
    expect((await screen.findAllByText("SubZero")).length).toBeGreaterThan(0);
    const recent = document.querySelector("[data-block='recent-winners']");
    expect(recent?.textContent).toContain("Bia");
    expect(recent?.textContent).toContain("apagado");
    expect(recent?.textContent).toContain("Anon");
    expect(document.querySelector("a[href='/dashboard/chat-giveaway/bia']")).toBeTruthy();
    expect(document.querySelector("a[href='/dashboard/chat-giveaway/cai']")).toBeNull();
    expect(recent?.querySelector("a[href*='unknown']")).toBeNull();
    const top = document.querySelector("[data-block='top-winners']");
    expect(top?.textContent).toContain("SubZero");
    expect(top?.textContent).not.toContain("Anon");
    expect(document.body.textContent).not.toContain("NightMod");
    expect(document.body.textContent).not.toContain("OCaster");
    const hidden = [...(recent?.querySelectorAll("[aria-hidden='true']") ?? [])];
    expect(hidden.some((node) => node.textContent?.includes("💬"))).toBe(true);

    expect(
      screen.getByRole("link", { name: "Bia, 1º lugar, 1 vitória" }),
    ).toBeTruthy();
    expect(screen.getByRole("columnheader", { name: "Vitórias" })).toBeTruthy();
    const tip = screen.getAllByRole("button", {
      name: "1 no Chat, 0 em Pontos do Canal, 0 em Subscribers",
    })[0];
    expect(tip).toBeTruthy();
    fireEvent.focus(tip);
    expect(await screen.findByRole("tooltip")).toBeTruthy();
    fireEvent.keyDown(tip, { key: "Escape" });
    await waitFor(() => {
      expect(screen.queryByRole("tooltip")).toBeNull();
    });

    const root = document.querySelector("[data-dashboard-root]");
    expect(root).toBeTruthy();
    const results = await axe.run(root as HTMLElement);
    const serious = results.violations.filter(
      (violation) => violation.impact === "serious" || violation.impact === "critical",
    );
    expect(serious.map((violation) => violation.id)).toEqual([]);

    fireEvent.click(screen.getByRole("link", { name: "Ana" }));
    expect(
      await screen.findByText(
        "O histórico de vitórias fica salvo só neste navegador. Limpar os dados do navegador apaga o histórico; outro PC tem outro histórico.",
      ),
    ).toBeTruthy();
    expect(document.body.textContent).not.toMatch(/seca atual/i);
    expect(document.querySelector("[data-showcase]")).toBeTruthy();
    expect(document.querySelector("[data-achievement-grid]")).toBeTruthy();
    expect(screen.getAllByText("Ainda não").length).toBeGreaterThan(0);

    cleanup();
    useSettingsStore.setState({ badges: { enabled: true } });
    renderDashboard({
      broadcasterId: "caster",
      loadSource: async () => data,
    });
    expect(
      (await screen.findAllByRole("button", { name: /Primeiro Drop/ })).length,
    ).toBeGreaterThan(0);
    expect(document.querySelector("[data-summary='achievements']")).toBeTruthy();
    useSettingsStore.getState().setBadgesEnabled(false);
    await waitFor(() => {
      expect(document.querySelector("[data-block='recent-achievements']")).toBeNull();
    });
    expect(document.querySelector("[data-summary='achievements']")).toBeNull();
    expect(screen.queryAllByRole("button", { name: /Primeiro Drop/ })).toHaveLength(0);
    expect(document.querySelector("[data-block='top-winners']")).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Subscribers" }));
    await waitFor(() => {
      expect(document.querySelector("[data-block='recent-winners']")?.textContent).toContain(
        "SubZero",
      );
    });
    expect(document.querySelector("[data-block='recent-winners']")?.textContent).not.toContain(
      "Bia",
    );
    expect(document.body.textContent ?? "").not.toMatch(/ver todos/i);
  }, 30_000);

  it("CA-D40: rei dividido aparece e o banco fica igual", async () => {
    await putRaw("chat-giveaways", [
      chatGiveaway("a1", "A1", "ana", "Ana", iso(2026, 9, 10), {
        createdAt: iso(2026, 9, 1),
      }),
      chatGiveaway("a2", "A2", "ana", "Ana", iso(2026, 9, 20), {
        createdAt: iso(2026, 9, 2),
      }),
      chatGiveaway("b1", "B1", "bia", "Bia", iso(2026, 9, 11), {
        createdAt: iso(2026, 9, 3),
      }),
      chatGiveaway("b2", "B2", "bia", "Bia", iso(2026, 9, 21), {
        createdAt: iso(2026, 9, 4),
      }),
    ]);
    const dbBefore = await dumpDatabase();
    renderDashboard({
      clock: { now: iso(2026, 10, 1, 0, 0), timeZone: TZ },
    });
    expect(
      (await screen.findAllByText("Rei de setembro · dividido")).length,
    ).toBeGreaterThan(0);
    const dbAfter = await dumpDatabase();
    expect(dbAfter.version).toBe(12);
    expect(dbAfter.body).toBe(dbBefore.body);
    expect(localStorage.getItem(STORAGE_KEY_STREAM_DROPS_SETTINGS)).toBeNull();
  }, 30_000);

  it("CA-D49: o resumo respeita mês, geral e exclusão", async () => {
    const data: DashboardSource = {
      chat: [
        {
          ...chatGiveaway("out-1", "Outubro 1", "ana", "Ana", iso(2026, 10, 5)),
          winners: [
            { id: "ana", name: "Ana", twitchId: "ana", drawnAt: iso(2026, 10, 5) },
            { id: "bia", name: "Bia", twitchId: "bia", drawnAt: iso(2026, 10, 6) },
            { id: "mod", name: "NightMod", twitchId: "mod", drawnAt: iso(2026, 10, 7) },
          ],
        },
        chatGiveaway("out-2", "Outubro apagado", "cai", "Cai", iso(2026, 10, 8), {
          deletedAt: iso(2026, 10, 9),
        }),
      ],
      channelPoints: [
        {
          id: "out-3",
          title: "Pontos",
          cost: 100,
          winners: [
            { id: "duda", userId: "duda", name: "Duda", drawnAt: iso(2026, 10, 9) },
          ],
          participants: [],
          createdAt: iso(2026, 10, 4),
        },
      ],
      subscribers: [
        {
          id: "legado",
          title: "Legado",
          winners: [{ user_id: "edu", user_name: "Edu", user_login: "edu" }],
          participants: [],
        },
      ],
      excludedUserIds: ["mod"],
    };
    renderDashboard({ loadSource: async () => data });
    expect((await screen.findAllByText("Duda")).length).toBeGreaterThan(0);
    expect(summaryValue("giveaways")).toBe("3");
    expect(summaryValue("wins")).toBe("4");
    expect(document.body.textContent).not.toContain("NightMod");
    fireEvent.click(screen.getByRole("button", { name: "Geral" }));
    await waitFor(() => {
      expect(summaryValue("giveaways")).toBe("4");
    });
    expect(summaryValue("wins")).toBe("5");
    expect(document.body.textContent).toContain("Edu");
  }, 30_000);

  it("CA-D51: conquistas do mês e o rei somem no filtro de Chat", async () => {
    const data: DashboardSource = {
      chat: [
        chatGiveaway("s1", "S1", "ana", "Ana", iso(2026, 9, 10), {
          createdAt: iso(2026, 9, 1),
        }),
        chatGiveaway("s2", "S2", "ana", "Ana", iso(2026, 9, 20), {
          createdAt: iso(2026, 9, 2),
        }),
        chatGiveaway("s3", "S3", "ana", "Ana", iso(2026, 10, 5)),
        chatGiveaway("b1", "B1", "bia", "Bia", iso(2026, 10, 2)),
        chatGiveaway("b2", "B2", "bia", "Bia", iso(2026, 10, 3)),
        chatGiveaway("b3", "B3", "bia", "Bia", iso(2026, 10, 4)),
        chatGiveaway("c1", "C1", "cai", "Cai", iso(2026, 10, 6)),
        chatGiveaway("c2", "C2", "cai", "Cai", iso(2026, 10, 7)),
        chatGiveaway("c3", "C3", "cai", "Cai", iso(2026, 10, 8)),
      ],
      channelPoints: [],
      subscribers: [],
      excludedUserIds: [],
    };
    renderDashboard({ loadSource: async () => data });
    expect(await screen.findByText("Rei de setembro")).toBeTruthy();
    expect(summaryValue("achievements")).toBe("4");
    fireEvent.click(screen.getByRole("button", { name: "Chat" }));
    await waitFor(() => {
      expect(summaryValue("achievements")).toBe("3");
    });
    expect(screen.queryByText("Rei de setembro")).toBeNull();
    useSettingsStore.getState().setBadgesEnabled(false);
    await waitFor(() => {
      expect(document.querySelector("[data-summary='achievements']")).toBeNull();
    });
    expect(document.querySelector("[data-block='recent-achievements']")).toBeNull();
    expect(document.querySelector("[data-block='top-winners']")).toBeTruthy();
  }, 30_000);
});
