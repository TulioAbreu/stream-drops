import { ThemeProvider } from "@/components/theme-provider";
import {
  DATABASE_VERSION,
  clearDatabase,
  openDb,
} from "@/database";
import "@/i18n";
import { SettingsPage } from "@/pages/settings";
import { STORAGE_KEY_STREAM_DROPS_SETTINGS } from "@/storage";
import { useLoginStore } from "@/storage/login";
import { useSettingsStore } from "@/storage/settings";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { page } from "vitest/browser";

const LOGIN_SENTINEL = JSON.stringify({
  state: {
    twitchAccessToken: "token-nao-apagar",
    driveCode: "drive-nao-apagar",
    sessionExpired: false,
  },
  version: 0,
});

const EXCLUSION_SENTINEL = "nao-apagar-exclusion-list";

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

function withoutSettings(
  snapshot: ReturnType<typeof storageSnapshot>,
) {
  return {
    ...snapshot,
    local: snapshot.local.filter(
      ([key]) => key !== STORAGE_KEY_STREAM_DROPS_SETTINGS,
    ),
  };
}

async function seedV12() {
  await putRaw("giveaways", [
    {
      id: "sub-legado",
      title: "Sorteio legado",
      description: "fica",
      subscriptionRequirement: 1000,
      subscriberMultiplier: { "1000": 1, "2000": 2, "3000": 3 },
      participants: [
        {
          broadcaster_id: "9",
          broadcaster_login: "canal",
          broadcaster_name: "Canal",
          gifter_id: "8",
          gifter_login: "gifter",
          is_gift: true,
          plan_name: "Tier 1",
          tier: "1000",
          user_id: "legacy-user",
          user_name: "Legado",
          user_login: "legado",
        },
      ],
      winners: [
        {
          broadcaster_id: "9",
          broadcaster_login: "canal",
          broadcaster_name: "Canal",
          gifter_id: "8",
          gifter_login: "gifter",
          is_gift: true,
          plan_name: "Tier 1",
          tier: "1000",
          user_id: "legacy-user",
          user_name: "Legado",
          user_login: "legado",
        },
      ],
      spreadsheetUrl: "https://docs.google.com/spreadsheets/d/abc/edit",
    },
  ]);
  await putRaw("chat-giveaways", [
    {
      id: "chat-ativo",
      title: "Chat ativo",
      description: "descrição salva",
      keyword: "!join",
      cost: 0,
      minimumSuscriptionTimeInMonths: 0,
      subscriberMultiplier: 2,
      subscribersOnly: false,
      winners: [
        {
          id: "4",
          name: "Fiel",
          twitchId: "4",
          avatar: "https://example.test/4.png",
          drawnAt: "2026-10-04T15:00:00.000Z",
          context: { subscriptionMonths: 24, tier: "3000" },
        },
      ],
      participants: [
        {
          id: "4",
          name: "fiel",
          displayName: "Fiel",
          avatar: "https://example.test/4.png",
          subscriber: true,
          subscriptionMonths: 24,
          tier: 3000,
          joinedAt: 1_700_000_000_000,
        },
      ],
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-02T00:00:00.000Z",
    },
    {
      id: "chat-apagado",
      title: "Chat apagado",
      description: "soft",
      keyword: "!join",
      cost: 0,
      minimumSuscriptionTimeInMonths: 0,
      subscriberMultiplier: 1,
      subscribersOnly: false,
      deletedAt: "2026-10-08T18:00:00.000Z",
      participants: [],
      participation: {
        v: 1,
        users: [["4", "Fiel", 1_700_000_000]],
      },
      winners: [
        {
          id: "4",
          name: "Fiel",
          twitchId: "4",
          avatar: "https://example.test/4.png",
          drawnAt: "2026-10-04T15:00:00.000Z",
        },
      ],
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-10-08T18:00:00.000Z",
    },
  ]);
  await putRaw("channel-points-giveaways", [
    {
      id: "points-ativo",
      title: "Pontos ativo",
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
      participants: [],
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
      createdAt: "2026-02-01T00:00:00.000Z",
      updatedAt: "2026-02-02T00:00:00.000Z",
    },
  ]);
  await putRaw("chat-participants", [
    {
      id: "chat-ativo:4",
      giveawayId: "chat-ativo",
      userId: "4",
      name: "fiel",
      displayName: "Fiel",
      avatar: "https://example.test/4.png",
      subscriber: true,
      joinedAt: 1_700_000_000_000,
    },
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

function renderSettings() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={client}>
      <ThemeProvider defaultTheme="dark" storageKey="vite-ui-theme">
        <MemoryRouter initialEntries={["/dashboard/settings"]}>
          <SettingsPage />
        </MemoryRouter>
      </ThemeProvider>
    </QueryClientProvider>,
  );
}

async function settleSettings() {
  expect(
    await screen.findByRole("heading", { name: "Selos e conquistas" }),
  ).toBeTruthy();
  expect(await screen.findByText("Nightbot")).toBeTruthy();
  expect(await screen.findByText("Pontos do canal")).toBeTruthy();
}

function badgesSwitch() {
  return screen.getByRole("switch", {
    name: "Mostrar selos e conquistas",
  }) as HTMLButtonElement;
}

describe("S5 toggle de selos", () => {
  beforeEach(async () => {
    await page.viewport(1280, 800);
    await clearDatabase();
    await seedV12();
    useLoginStore.setState({
      twitchAccessToken: null,
      driveCode: null,
      sessionExpired: false,
    });
    localStorage.setItem("vite-ui-theme", "dark");
    localStorage.setItem("login-storage", LOGIN_SENTINEL);
    localStorage.setItem("exclusion-list", EXCLUSION_SENTINEL);
    localStorage.setItem("sd-s5-canary", "fica");
    localStorage.removeItem(STORAGE_KEY_STREAM_DROPS_SETTINGS);
    sessionStorage.setItem("sd-s5-session", "fica");
    document.cookie = "sd_s5=1; path=/";
    await useSettingsStore.persist.rehydrate();
  });

  afterEach(async () => {
    cleanup();
    useSettingsStore.setState({ badges: { enabled: true } });
    localStorage.removeItem(STORAGE_KEY_STREAM_DROPS_SETTINGS);
    useLoginStore.setState({
      twitchAccessToken: null,
      driveCode: null,
      sessionExpired: false,
    });
    localStorage.removeItem("login-storage");
    localStorage.removeItem("vite-ui-theme");
    localStorage.removeItem("exclusion-list");
    localStorage.removeItem("sd-s5-canary");
    sessionStorage.removeItem("sd-s5-session");
    document.cookie = "sd_s5=; path=/; max-age=0";
    await clearDatabase();
  });

  it("abrir Configurações não reescreve a v12 nem as chaves antigas", async () => {
    const dbBefore = await dumpDatabase();
    const storageBefore = storageSnapshot();
    const spy = installSpies();

    try {
      renderSettings();
      await settleSettings();
      expect(badgesSwitch().getAttribute("aria-checked")).toBe("true");
      expect(
        screen.getByText(
          "As estatísticas continuam disponíveis no Hall da Fama.",
        ),
      ).toBeTruthy();
      expect(screen.queryAllByRole("img", { name: /raridade/i })).toEqual([]);
      expect(document.querySelectorAll("[data-slot='rarity-badge']")).toHaveLength(
        0,
      );

      const points = screen.getByRole("link", { name: /pontos do canal/i });
      expect(points.getAttribute("href")).toBe(
        "/dashboard/channel-points-giveaway",
      );
      expect(points.textContent).not.toMatch(/beta/i);
      const subathon = screen.getByRole("link", { name: /subathon/i });
      expect(subathon.textContent).toMatch(/beta/i);
      expect(screen.getAllByText("Beta")).toHaveLength(1);
      const text = document.body.textContent ?? "";
      expect(text).not.toMatch(/kick/i);
      expect(text).not.toMatch(/youtube/i);

      expect(
        screen.getByRole("button", { name: "Escuro" }).getAttribute("aria-pressed"),
      ).toBe("true");
    } finally {
      spy.restore();
    }

    expect(spy.storageWrites).toEqual([]);
    expect(spy.idbWrites).toEqual([]);
    expect(spy.readwrite).toEqual([]);
    const dbAfter = await dumpDatabase();
    expect(dbBefore.version).toBe(12);
    expect(DATABASE_VERSION).toBe(12);
    expect(dbAfter.version).toBe(12);
    expect(dbAfter.names).toEqual(dbBefore.names);
    expect(dbAfter.names).not.toContain("winner-events");
    expect(dbAfter.body).toBe(dbBefore.body);
    expect(storageSnapshot()).toEqual(storageBefore);
    expect(localStorage.getItem(STORAGE_KEY_STREAM_DROPS_SETTINGS)).toBeNull();
    expect(localStorage.getItem("vite-ui-theme")).toBe("dark");
    expect(localStorage.getItem("login-storage")).toBe(LOGIN_SENTINEL);
    expect(localStorage.getItem("exclusion-list")).toBe(EXCLUSION_SENTINEL);
    expect(useLoginStore.getState().twitchAccessToken).toBeNull();
  }, 30_000);

  it("CA24: JSON inválido ou versão estranha conta como ligado e fica no disco", async () => {
    const cases = [
      "{not-json",
      "[]",
      JSON.stringify({ enabled: false }),
      JSON.stringify({
        state: { badges: { enabled: false }, extra: "nao-perder" },
        version: 99,
      }),
      JSON.stringify({
        state: { badges: { enabled: false } },
        version: "1",
      }),
    ];

    for (const raw of cases) {
      localStorage.setItem(STORAGE_KEY_STREAM_DROPS_SETTINGS, raw);
      const dbBefore = await dumpDatabase();
      const storageBefore = storageSnapshot();
      const spy = installSpies();
      try {
        await useSettingsStore.persist.rehydrate();
        cleanup();
        renderSettings();
        await settleSettings();
        expect(badgesSwitch().getAttribute("aria-checked")).toBe("true");
        expect(useSettingsStore.getState().badges.enabled).toBe(true);
      } finally {
        spy.restore();
      }
      expect(spy.storageWrites).toEqual([]);
      expect(spy.idbWrites).toEqual([]);
      expect(spy.readwrite).toEqual([]);
      expect(localStorage.getItem(STORAGE_KEY_STREAM_DROPS_SETTINGS)).toBe(raw);
      expect(storageSnapshot()).toEqual(storageBefore);
      const dbAfter = await dumpDatabase();
      expect(dbAfter.version).toBe(12);
      expect(dbAfter.body).toBe(dbBefore.body);
      cleanup();
    }
  }, 30_000);

  it("CA24: versão 1 com lixo no enabled fica ligado e não regrava", async () => {
    const raw = JSON.stringify({
      state: { badges: { enabled: "sim", note: "antigo" }, theme: "dark" },
      version: 1,
    });
    localStorage.setItem(STORAGE_KEY_STREAM_DROPS_SETTINGS, raw);
    const dbBefore = await dumpDatabase();
    const spy = installSpies();
    try {
      await useSettingsStore.persist.rehydrate();
      renderSettings();
      await settleSettings();
      expect(badgesSwitch().getAttribute("aria-checked")).toBe("true");
    } finally {
      spy.restore();
    }
    expect(spy.storageWrites).toEqual([]);
    expect(spy.idbWrites).toEqual([]);
    expect(localStorage.getItem(STORAGE_KEY_STREAM_DROPS_SETTINGS)).toBe(raw);
    expect((await dumpDatabase()).body).toBe(dbBefore.body);
  });

  it("CA24: desligar e reidratar mantém desligado, sem tocar no resto", async () => {
    const dbBefore = await dumpDatabase();
    const storageBefore = storageSnapshot();
    const spy = installSpies();
    try {
      renderSettings();
      await settleSettings();
      fireEvent.click(badgesSwitch());
      expect(badgesSwitch().getAttribute("aria-checked")).toBe("false");
    } finally {
      spy.restore();
    }

    expect(spy.storageWrites).toEqual([
      `set:local:${STORAGE_KEY_STREAM_DROPS_SETTINGS}`,
    ]);
    expect(spy.idbWrites).toEqual([]);
    expect(spy.readwrite).toEqual([]);
    expect(JSON.parse(localStorage.getItem(STORAGE_KEY_STREAM_DROPS_SETTINGS)!)).toEqual({
      state: { badges: { enabled: false } },
      version: 1,
    });
    expect(withoutSettings(storageSnapshot())).toEqual(withoutSettings(storageBefore));
    expect((await dumpDatabase()).body).toBe(dbBefore.body);

    cleanup();
    await useSettingsStore.persist.rehydrate();
    expect(useSettingsStore.getState().badges.enabled).toBe(false);
    expect(JSON.parse(localStorage.getItem(STORAGE_KEY_STREAM_DROPS_SETTINGS)!)).toEqual({
      state: { badges: { enabled: false } },
      version: 1,
    });

    const spyReload = installSpies();
    try {
      renderSettings();
      await settleSettings();
      expect(badgesSwitch().getAttribute("aria-checked")).toBe("false");
    } finally {
      spyReload.restore();
    }
    expect(spyReload.storageWrites).toEqual([]);
    expect(spyReload.idbWrites).toEqual([]);
    expect(spyReload.readwrite).toEqual([]);
    expect(withoutSettings(storageSnapshot())).toEqual(withoutSettings(storageBefore));
    const dbAfter = await dumpDatabase();
    expect(dbAfter.version).toBe(12);
    expect(dbAfter.body).toBe(dbBefore.body);
    expect(localStorage.getItem("vite-ui-theme")).toBe("dark");
    expect(localStorage.getItem("login-storage")).toBe(LOGIN_SENTINEL);
    expect(localStorage.getItem("exclusion-list")).toBe(EXCLUSION_SENTINEL);
  }, 30_000);

  it("migrate de versão desconhecida devolve ligado e não grava", async () => {
    const dbBefore = await dumpDatabase();
    const storageBefore = storageSnapshot();
    const migrate = useSettingsStore.persist.getOptions().migrate;
    expect(migrate).toBeTypeOf("function");
    expect(migrate?.({ badges: { enabled: false }, extra: 1 }, 0)).toEqual({
      badges: { enabled: true },
    });
    expect(migrate?.({ badges: { enabled: false } }, 2)).toEqual({
      badges: { enabled: true },
    });
    expect(migrate?.({ badges: { enabled: false } }, 1)).toEqual({
      badges: { enabled: false },
    });
    expect(storageSnapshot()).toEqual(storageBefore);
    expect((await dumpDatabase()).body).toBe(dbBefore.body);
    expect((await dumpDatabase()).version).toBe(12);
  });
});
