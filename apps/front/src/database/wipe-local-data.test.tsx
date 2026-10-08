import { DeleteLocalDataDialog } from "@/components/delete-local-data-dialog";
import { LogoutDialog } from "@/components/logout-dialog";
import {
  DATABASE_NAME,
  DATABASE_VERSION,
  closeDb,
  openDb,
} from "@/database";
import { wipeLocalData } from "@/database/clear-browser-data";
import "@/i18n";
import { useLoginStore } from "@/storage/login";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { Toaster } from "sonner";

const EXTRA_DATABASE = "stream-drops-extra-test";
const TOKEN = "token-local-do-navegador";
const KEEP_COOKIE = "sd_s6_keep";

const STORES = [
  "exclusion-list",
  "giveaways",
  "chat-giveaways",
  "chat-giveaway-templates",
  "chat-participants",
  "roulettes",
  "channel-points-giveaways",
] as const;

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function cookieHas(name: string) {
  return document.cookie
    .split(";")
    .some((part) => part.trim().startsWith(`${name}=`));
}

function deleteNamed(name: string): Promise<void> {
  closeDb();
  return new Promise((resolve) => {
    const request = indexedDB.deleteDatabase(name);
    const timer = setTimeout(resolve, 2000);
    request.onsuccess = () => {
      clearTimeout(timer);
      resolve();
    };
    request.onerror = () => {
      clearTimeout(timer);
      resolve();
    };
  });
}

async function putRecords(storeName: string, records: unknown[]) {
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

function dump(db: IDBDatabase): Promise<{ version: number; body: string }> {
  const names = STORES.filter((name) => db.objectStoreNames.contains(name));
  return new Promise((resolve, reject) => {
    const tx = db.transaction([...names], "readonly");
    const stores: Record<string, unknown[]> = {};
    for (const name of names) {
      const request = tx.objectStore(name).getAll();
      request.onsuccess = () => {
        const rows = [...(request.result as Array<Record<string, unknown>>)];
        rows.sort((left, right) => {
          const leftKey = String(left.id ?? left.twitchUserId ?? "");
          const rightKey = String(right.id ?? right.twitchUserId ?? "");
          return leftKey.localeCompare(rightKey);
        });
        stores[name] = rows;
      };
    }
    tx.oncomplete = () => {
      resolve({ version: db.version, body: JSON.stringify(stores) });
    };
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error);
  });
}

function createExtraDatabase(): Promise<void> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(EXTRA_DATABASE, 1);
    request.onupgradeneeded = () => {
      request.result
        .createObjectStore("notes", { keyPath: "id" })
        .add({ id: "1", text: "outro banco do site" });
    };
    request.onsuccess = () => {
      request.result.close();
      resolve();
    };
    request.onerror = () => reject(request.error);
  });
}

function holdDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DATABASE_NAME);
    request.onsuccess = () => {
      const db = request.result;
      db.onversionchange = () => {
        // Outra aba que não solta o banco.
      };
      resolve(db);
    };
    request.onerror = () => reject(request.error);
  });
}

async function seedV12() {
  await deleteNamed(DATABASE_NAME);
  await deleteNamed(EXTRA_DATABASE);
  await putRecords("chat-giveaways", [
    {
      id: "chat-ativo",
      title: "Chat ativo",
      description: "registro ativo",
      keyword: "!join",
      cost: 0,
      minimumSuscriptionTimeInMonths: 0,
      subscriberMultiplier: 2,
      subscribersOnly: false,
      winners: [
        {
          id: "w-ana",
          name: "Ana",
          twitchId: "111",
          avatar: "a.png",
          drawnAt: "2026-10-01T15:00:00.000Z",
          context: { subscriptionMonths: 24, tier: 3000 },
        },
      ],
      participants: [
        {
          id: "111",
          name: "ana",
          displayName: "Ana",
          avatar: "a.png",
          subscriber: true,
          subscriptionMonths: 24,
          tier: 3000,
          joinedAt: 1_700_000_000_000,
        },
      ],
      createdAt: "2026-09-01T00:00:00.000Z",
      updatedAt: "2026-10-01T15:00:00.000Z",
    },
    {
      id: "chat-apagado",
      title: "Chat soft-deleted",
      description: "vitória permanece no registro até o wipe",
      keyword: "!join",
      cost: 0,
      minimumSuscriptionTimeInMonths: 0,
      subscriberMultiplier: 1,
      subscribersOnly: false,
      winners: [
        {
          id: "w-bia",
          name: "Bia",
          twitchId: "222",
          avatar: "b.png",
          drawnAt: "2026-08-01T12:00:00.000Z",
        },
      ],
      participants: [],
      createdAt: "2026-07-01T00:00:00.000Z",
      updatedAt: "2026-08-02T00:00:00.000Z",
      deletedAt: "2026-10-01T12:00:00.000Z",
      participation: { v: 1, users: [["222", "Bia", 1_720_000_000]] },
    },
  ]);
  await putRecords("chat-participants", [
    {
      id: "chat-ativo:111",
      giveawayId: "chat-ativo",
      userId: "111",
      name: "ana",
      displayName: "Ana",
      avatar: "a.png",
      subscriber: true,
      subscriptionMonths: 24,
      tier: 3000,
      joinedAt: 1_700_000_000_000,
    },
  ]);
  await putRecords("channel-points-giveaways", [
    {
      id: "pontos-ativo",
      title: "Pontos ativo",
      description: "ativo",
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
          id: "w-ponto",
          userId: "333",
          name: "Caio",
          avatar: "c.png",
          redemptionId: "r1",
          drawnAt: "2026-09-02T12:00:00.000Z",
        },
      ],
      createdAt: "2026-09-01T00:00:00.000Z",
      updatedAt: "2026-09-02T12:00:00.000Z",
    },
    {
      id: "pontos-apagado",
      title: "Pontos soft-deleted",
      description: "podado",
      cost: 50,
      rewardId: null,
      maxPerStream: null,
      subscribersOnly: false,
      subscriptionRequirement: 1000,
      subscriberMultiplier: { "1000": 1, "2000": 2, "3000": 3 },
      refundIneligible: false,
      allowMultipleWins: true,
      status: "closed",
      participants: [],
      winners: [
        {
          id: "w-ponto-2",
          userId: "444",
          name: "Duda",
          avatar: "d.png",
          redemptionId: "r2",
          drawnAt: "2026-06-02T12:00:00.000Z",
        },
      ],
      createdAt: "2026-06-01T00:00:00.000Z",
      updatedAt: "2026-06-02T12:00:00.000Z",
      deletedAt: "2026-10-02T12:00:00.000Z",
      participation: { v: 1, users: [["444", "Duda", 1_717_000_000, 1]] },
    },
  ]);
  await putRecords("giveaways", [
    {
      id: "sub-ativo",
      title: "Subs ativo",
      description: "ativo",
      subscriptionRequirement: 1000,
      subscriberMultiplier: { "1000": 1, "2000": 2, "3000": 3 },
      participants: [],
      winners: [
        {
          broadcaster_id: "9",
          broadcaster_login: "canal",
          broadcaster_name: "Canal",
          gifter_id: "",
          gifter_login: "",
          is_gift: false,
          plan_name: "Tier 1",
          tier: "1000",
          user_id: "555",
          user_name: "Eva",
          user_login: "eva",
          drawnAt: "2026-10-03T12:00:00.000Z",
        },
      ],
      spreadsheetUrl: null,
      createdAt: "2026-10-03T00:00:00.000Z",
      updatedAt: "2026-10-03T12:00:00.000Z",
    },
    {
      id: "sub-apagado",
      title: "Subs soft-deleted",
      description: "sem resumo de participação",
      subscriptionRequirement: 1000,
      subscriberMultiplier: { "1000": 1, "2000": 2, "3000": 3 },
      participants: [],
      winners: [
        {
          broadcaster_id: "9",
          broadcaster_login: "canal",
          broadcaster_name: "Canal",
          gifter_id: "777",
          gifter_login: "gifter",
          is_gift: true,
          plan_name: "Tier 1",
          tier: "1000",
          user_id: "666",
          user_name: "Fê",
          user_login: "fe",
        },
      ],
      spreadsheetUrl: null,
      deletedAt: "2026-10-04T12:00:00.000Z",
    },
  ]);
  await putRecords("exclusion-list", [
    {
      twitchUserId: "100",
      username: "nightbot",
      displayName: "Nightbot",
      profileImageUrl: "",
      updatedAt: "2026-01-01T00:00:00.000Z",
    },
  ]);
  await putRecords("chat-giveaway-templates", [
    {
      id: "template-1",
      name: "Padrão",
      settings: { title: "Modelo", keyword: "!join" },
      createdAt: "2026-01-01T00:00:00.000Z",
    },
  ]);
  await putRecords("roulettes", [
    { id: "roleta-1", title: "Roleta", options: ["A", "B"] },
  ]);
  await createExtraDatabase();

  const db = await openDb();
  expect(db.version).toBe(12);
  expect(DATABASE_VERSION).toBe(12);
  return dump(db);
}

function seedBrowserStorage() {
  localStorage.clear();
  sessionStorage.clear();
  localStorage.setItem(
    "login-storage",
    JSON.stringify({
      state: {
        twitchAccessToken: TOKEN,
        driveCode: "drive-secreto",
        sessionExpired: false,
      },
    }),
  );
  localStorage.setItem(
    "stream-drops-settings",
    JSON.stringify({ state: { badges: { enabled: true } }, version: 1 }),
  );
  localStorage.setItem("vite-ui-theme", "dark");
  localStorage.setItem("stream-drops-subathon-last-port", "8080");
  localStorage.setItem("stream-drops-subathon-eventsub", "true");
  sessionStorage.setItem("sd-s6", "sessao");
  document.cookie = "sidebar_state=true; path=/";
  document.cookie = `${KEEP_COOKIE}=1; path=/`;
}

function storageSnapshot() {
  return {
    local: Object.keys(localStorage)
      .sort()
      .map((key) => [key, localStorage.getItem(key)]),
    session: Object.keys(sessionStorage)
      .sort()
      .map((key) => [key, sessionStorage.getItem(key)]),
    sidebar: cookieHas("sidebar_state"),
    keep: cookieHas(KEEP_COOKIE),
  };
}

async function databaseNames() {
  return (await indexedDB.databases()).map((database) => database.name);
}

let holder: IDBDatabase | null = null;

describe("wipeLocalData na v12", () => {
  afterEach(async () => {
    cleanup();
    holder?.close();
    holder = null;
    useLoginStore.setState({
      twitchAccessToken: null,
      driveCode: null,
      sessionExpired: false,
    });
    localStorage.clear();
    sessionStorage.clear();
    document.cookie = "sidebar_state=; path=/; max-age=0";
    document.cookie = `${KEEP_COOKIE}=; path=/; max-age=0`;
    await deleteNamed(DATABASE_NAME);
    await deleteNamed(EXTRA_DATABASE);
  });

  it("CA-SD9: apaga o que a spec manda e deixa o cookie que não é do app", async () => {
    const before = await seedV12();
    expect(before.body).toContain("chat-apagado");
    expect(before.body).toContain("pontos-apagado");
    expect(before.body).toContain("sub-apagado");
    seedBrowserStorage();
    const requests: string[] = [];
    const originalFetch = window.fetch.bind(window);
    const originalOpen = XMLHttpRequest.prototype.open;
    window.fetch = (async (...args: Parameters<typeof fetch>) => {
      requests.push(String(args[0]));
      return originalFetch(...args);
    }) as typeof fetch;
    XMLHttpRequest.prototype.open = function (
      method: string,
      url: string | URL,
      async?: boolean,
      username?: string | null,
      password?: string | null,
    ) {
      requests.push(String(url));
      return originalOpen.call(
        this,
        method,
        url,
        async ?? true,
        username,
        password,
      );
    };

    try {
      await wipeLocalData();
    } finally {
      window.fetch = originalFetch;
      XMLHttpRequest.prototype.open = originalOpen;
    }

    const names = await databaseNames();
    expect(names).not.toContain(DATABASE_NAME);
    expect(names).not.toContain(EXTRA_DATABASE);
    expect(localStorage.length).toBe(0);
    expect(localStorage.getItem("login-storage")).toBeNull();
    expect(sessionStorage.length).toBe(0);
    expect(cookieHas("sidebar_state")).toBe(false);
    expect(cookieHas(KEEP_COOKIE)).toBe(true);
    expect(requests.some((url) => /twitch|revoke/i.test(url))).toBe(false);
  });

  it("fecha a conexão desta aba antes de pedir o delete", async () => {
    await seedV12();
    const own = await openDb();
    const closed: boolean[] = [];
    const original = indexedDB.deleteDatabase.bind(indexedDB);
    indexedDB.deleteDatabase = ((name: string) => {
      try {
        own.transaction("giveaways", "readonly");
        closed.push(false);
      } catch {
        closed.push(true);
      }
      return original(name);
    }) as typeof indexedDB.deleteDatabase;

    try {
      await wipeLocalData();
    } finally {
      indexedDB.deleteDatabase = original;
    }

    expect(closed.length).toBeGreaterThan(0);
    expect(closed.every(Boolean)).toBe(true);
  });

  it("outra aba com o banco aberto não altera o que ficou", async () => {
    const before = await seedV12();
    seedBrowserStorage();
    const storageBefore = storageSnapshot();
    holder = await holdDatabase();
    let blocked = "";
    let settled = false;
    const pending = wipeLocalData({
      onBlocked: (name) => {
        blocked = name;
      },
    });
    pending.then(
      () => {
        settled = true;
      },
      () => {
        settled = true;
      },
    );

    const start = Date.now();
    while (!blocked) {
      if (Date.now() - start > 2000) {
        throw new Error("onblocked não disparou");
      }
      await delay(10);
    }
    await delay(40);

    const during = await dump(holder);
    expect(settled).toBe(false);
    expect(blocked).toBe(DATABASE_NAME);
    expect(during.version).toBe(12);
    expect(during.body).toBe(before.body);
    expect(storageSnapshot()).toEqual(storageBefore);
    expect(await databaseNames()).toEqual(
      expect.arrayContaining([DATABASE_NAME, EXTRA_DATABASE]),
    );

    holder.close();
    holder = null;
    await pending;

    const names = await databaseNames();
    expect(names).not.toContain(DATABASE_NAME);
    expect(names).not.toContain(EXTRA_DATABASE);
    expect(localStorage.length).toBe(0);
    expect(sessionStorage.length).toBe(0);
    expect(cookieHas("sidebar_state")).toBe(false);
    expect(cookieHas(KEEP_COOKIE)).toBe(true);
  });

  it("apaga stream-drops-db quando databases() não existe", async () => {
    await seedV12();
    const idb = indexedDB as IDBFactory & { databases?: unknown };
    const original = idb.databases;
    idb.databases = undefined;
    try {
      await wipeLocalData();
    } finally {
      idb.databases = original;
    }
    expect(await databaseNames()).not.toContain(DATABASE_NAME);
    expect(await databaseNames()).toContain(EXTRA_DATABASE);
  });

  it("apaga stream-drops-db mesmo se databases() não listar nada", async () => {
    await seedV12();
    seedBrowserStorage();
    const idb = indexedDB as IDBFactory & {
      databases?: () => Promise<Array<{ name?: string | null }>>;
    };
    const original = idb.databases;
    idb.databases = async () => [];
    try {
      await wipeLocalData();
    } finally {
      idb.databases = original;
    }

    const names = await databaseNames();
    expect(names).not.toContain(DATABASE_NAME);
    expect(names).toContain(EXTRA_DATABASE);
    expect(localStorage.length).toBe(0);
    expect(cookieHas("sidebar_state")).toBe(false);
    expect(cookieHas(KEEP_COOKIE)).toBe(true);
  });

  it("um open em andamento não recria o banco depois do wipe", async () => {
    await seedV12();
    closeDb();
    const opening = openDb();
    await wipeLocalData();
    await opening.catch(() => undefined);
    await delay(30);
    expect(await databaseNames()).not.toContain(DATABASE_NAME);
  });

  it("o botão só apaga depois de digitar APAGAR", async () => {
    const before = await seedV12();
    seedBrowserStorage();
    const storageBefore = storageSnapshot();
    let left = false;
    render(
      <>
        <Toaster />
        <DeleteLocalDataDialog
          leave={() => {
            left = true;
          }}
          trigger={<button type="button">abrir apagar</button>}
        />
      </>,
    );

    fireEvent.click(screen.getByRole("button", { name: /abrir apagar/i }));
    fireEvent.click(
      screen.getByRole("button", { name: /apagar todos os dados/i }),
    );
    await delay(30);
    expect(left).toBe(false);
    const stillThere = await dump(await openDb());
    expect(stillThere.version).toBe(12);
    expect(stillThere.body).toBe(before.body);
    expect(storageSnapshot()).toEqual(storageBefore);

    fireEvent.change(screen.getByLabelText(/digite apagar para confirmar/i), {
      target: { value: "apagar" },
    });
    fireEvent.click(
      screen.getByRole("button", { name: /apagar todos os dados/i }),
    );

    await waitFor(() => {
      expect(left).toBe(true);
    });
    expect(await databaseNames()).not.toContain(DATABASE_NAME);
    expect(localStorage.length).toBe(0);
    expect(sessionStorage.length).toBe(0);
    expect(cookieHas("sidebar_state")).toBe(false);
    expect(cookieHas(KEEP_COOKIE)).toBe(true);
  });

  it("logout sem a caixa zera o token e mantém a v12", async () => {
    const before = await seedV12();
    seedBrowserStorage();
    useLoginStore.setState({
      twitchAccessToken: TOKEN,
      driveCode: "drive-secreto",
      sessionExpired: false,
    });
    let left = false;
    render(
      <LogoutDialog
        leave={() => {
          left = true;
        }}
        trigger={<button type="button">abrir logout</button>}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: /abrir logout/i }));
    expect(screen.getByRole("checkbox").getAttribute("aria-checked")).toBe(
      "false",
    );
    fireEvent.click(screen.getByRole("button", { name: /sair da conta/i }));

    expect(left).toBe(true);
    const after = await dump(await openDb());
    expect(after.version).toBe(12);
    expect(after.body).toBe(before.body);
    expect(useLoginStore.getState().twitchAccessToken).toBeNull();
    expect(useLoginStore.getState().driveCode).toBe("drive-secreto");
    expect(localStorage.getItem("stream-drops-settings")).toContain(
      "badges",
    );
    expect(localStorage.getItem("vite-ui-theme")).toBe("dark");
    expect(localStorage.getItem("stream-drops-subathon-last-port")).toBe(
      "8080",
    );
    expect(sessionStorage.getItem("sd-s6")).toBe("sessao");
    expect(cookieHas("sidebar_state")).toBe(true);
    expect(cookieHas(KEEP_COOKIE)).toBe(true);
    expect(await databaseNames()).toEqual(
      expect.arrayContaining([DATABASE_NAME, EXTRA_DATABASE]),
    );
  });

  it("logout com a caixa apaga a v12 inteira", async () => {
    await seedV12();
    seedBrowserStorage();
    useLoginStore.setState({
      twitchAccessToken: TOKEN,
      driveCode: "drive-secreto",
      sessionExpired: false,
    });
    let left = false;
    render(
      <>
        <Toaster />
        <LogoutDialog
          leave={() => {
            left = true;
          }}
          trigger={<button type="button">abrir logout</button>}
        />
      </>,
    );

    fireEvent.click(screen.getByRole("button", { name: /abrir logout/i }));
    fireEvent.click(screen.getByRole("checkbox"));
    fireEvent.click(screen.getByRole("button", { name: /sair da conta/i }));

    await waitFor(() => {
      expect(left).toBe(true);
    });
    const names = await databaseNames();
    expect(names).not.toContain(DATABASE_NAME);
    expect(names).not.toContain(EXTRA_DATABASE);
    expect(localStorage.length).toBe(0);
    expect(sessionStorage.length).toBe(0);
    expect(cookieHas("sidebar_state")).toBe(false);
    expect(cookieHas(KEEP_COOKIE)).toBe(true);
  });

  it("com outra aba aberta o botão avisa e não mexe nos registros", async () => {
    const before = await seedV12();
    seedBrowserStorage();
    holder = await holdDatabase();
    let left = false;
    render(
      <>
        <Toaster />
        <DeleteLocalDataDialog
          leave={() => {
            left = true;
          }}
          trigger={<button type="button">abrir apagar</button>}
        />
      </>,
    );

    fireEvent.click(screen.getByRole("button", { name: /abrir apagar/i }));
    fireEvent.change(screen.getByLabelText(/digite apagar para confirmar/i), {
      target: { value: "APAGAR" },
    });
    fireEvent.click(
      screen.getByRole("button", { name: /apagar todos os dados/i }),
    );

    expect(
      await screen.findByText(/feche as outras abas do stream drops/i),
    ).toBeTruthy();
    expect(left).toBe(false);
    const during = await dump(holder);
    expect(during.version).toBe(12);
    expect(during.body).toBe(before.body);
    expect(localStorage.getItem("login-storage")).toContain(TOKEN);
    expect(sessionStorage.getItem("sd-s6")).toBe("sessao");
    expect(cookieHas("sidebar_state")).toBe(true);

    holder.close();
    holder = null;
    await waitFor(() => {
      expect(left).toBe(true);
    });
    expect(await databaseNames()).not.toContain(DATABASE_NAME);
    expect(localStorage.length).toBe(0);
    expect(cookieHas(KEEP_COOKIE)).toBe(true);
  });
});
