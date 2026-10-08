import { clearDatabase, openDb } from "@/database";
import "@/i18n";
import { ChannelPointsGiveawayEdit } from "@/pages/channel-points-giveaway/[id]/edit";
import { ChannelPointsGiveawayDetail } from "@/pages/channel-points-giveaway/[id]";
import { ChannelPointsGiveawayPage } from "@/pages/channel-points-giveaway";
import { ChatGiveawayEdit } from "@/pages/chat-giveaway/[id]/edit";
import { ChatGiveawayDetail } from "@/pages/chat-giveaway/[id]";
import { ChatGiveaway } from "@/pages/chat-giveaway";
import { DashboardPage } from "@/pages/dashboard";
import { EditFollowerGiveawayPage } from "@/pages/follower-giveaway/[id]/edit";
import { FollowerGiveawayId } from "@/pages/follower-giveaway/[id]";
import { FollowerGiveaway } from "@/pages/follower-giveaway";
import { useLoginStore } from "@/storage/login";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes, useLocation } from "react-router";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

const STORES = [
  "exclusion-list",
  "giveaways",
  "chat-giveaways",
  "chat-giveaway-templates",
  "chat-participants",
  "roulettes",
  "channel-points-giveaways",
] as const;

const DELETED_AT = "2026-10-08T18:00:00.000Z";

function LocationProbe() {
  const location = useLocation();
  return <div data-testid="location">{location.pathname}</div>;
}

function renderAt(path: string) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={[path]}>
        <Routes>
          <Route path="/dashboard" element={<><LocationProbe /><DashboardPage /></>} />
          <Route path="/dashboard/chat-giveaway" element={<><LocationProbe /><ChatGiveaway /></>} />
          <Route path="/dashboard/chat-giveaway/:id/edit" element={<><LocationProbe /><ChatGiveawayEdit /></>} />
          <Route path="/dashboard/chat-giveaway/:id" element={<><LocationProbe /><ChatGiveawayDetail /></>} />
          <Route path="/dashboard/channel-points-giveaway" element={<><LocationProbe /><ChannelPointsGiveawayPage /></>} />
          <Route path="/dashboard/channel-points-giveaway/:id/edit" element={<><LocationProbe /><ChannelPointsGiveawayEdit /></>} />
          <Route path="/dashboard/channel-points-giveaway/:id" element={<><LocationProbe /><ChannelPointsGiveawayDetail /></>} />
          <Route path="/dashboard/follower-giveaway" element={<><LocationProbe /><FollowerGiveaway /></>} />
          <Route path="/dashboard/follower-giveaway/:id/edit" element={<><LocationProbe /><EditFollowerGiveawayPage /></>} />
          <Route path="/dashboard/follower-giveaway/:id" element={<><LocationProbe /><FollowerGiveawayId /></>} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
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

async function dumpDatabase(): Promise<{ version: number; body: string }> {
  const db = await openDb();
  const stores: Record<string, unknown[]> = {};
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction([...STORES], "readonly");
    for (const name of STORES) {
      const request = tx.objectStore(name).getAll();
      request.onsuccess = () => {
        const rows = [...(request.result as Array<{ id?: string }>)]
          .sort((left, right) => String(left.id ?? "").localeCompare(String(right.id ?? "")));
        stores[name] = rows;
      };
    }
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
  return { version: db.version, body: JSON.stringify(stores) };
}

function storageSnapshot() {
  return {
    local: Object.keys(localStorage).sort().map((key) => [key, localStorage.getItem(key)]),
    session: Object.keys(sessionStorage).sort().map((key) => [key, sessionStorage.getItem(key)]),
    cookie: document.cookie,
  };
}

function installWriteSpy() {
  const writes: string[] = [];
  const readwrite: string[] = [];
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
    if ((mode ?? "readonly") === "readwrite") {
      const names = typeof storeNames === "string" ? [storeNames] : [...storeNames];
      readwrite.push(names.join(","));
    }
    return tx;
  };
  const track = (op: string) =>
    function (this: IDBObjectStore, ...args: [unknown, ...unknown[]]) {
      writes.push(`${op}:${this.name}`);
      const original = op === "put" ? originalPut : op === "add" ? originalAdd : originalDelete;
      return original.apply(this, args as never);
    };
  IDBObjectStore.prototype.put = track("put") as IDBObjectStore["put"];
  IDBObjectStore.prototype.add = track("add") as IDBObjectStore["add"];
  IDBObjectStore.prototype.delete = track("delete") as IDBObjectStore["delete"];

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

function chat(id: string, title: string, deletedAt?: string) {
  return {
    id,
    title,
    description: "",
    keyword: "!join",
    cost: 0,
    minimumSuscriptionTimeInMonths: 0,
    subscriberMultiplier: 1,
    subscribersOnly: false,
    winners: [],
    participants: [{ id: "p1", name: "p1", displayName: "Pessoa", avatar: "", subscriber: false, joinedAt: 1 }],
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    ...(deletedAt ? { deletedAt, participants: [] } : {}),
  };
}

function points(id: string, title: string, deletedAt?: string) {
  return {
    id,
    title,
    description: "",
    cost: 100,
    rewardId: null,
    maxPerStream: null,
    subscribersOnly: false,
    subscriptionRequirement: 1000,
    subscriberMultiplier: { "1000": 1, "2000": 2, "3000": 3 },
    refundIneligible: false,
    allowMultipleWins: false,
    status: "open",
    participants: [],
    winners: [],
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    ...(deletedAt ? { deletedAt } : {}),
  };
}

function subscriber(id: string, title: string, deletedAt?: string) {
  return {
    id,
    title,
    description: "",
    subscriptionRequirement: 1000,
    subscriberMultiplier: { "1000": 1, "2000": 2, "3000": 3 },
    participants: [],
    winners: [],
    spreadsheetUrl: null,
    ...(deletedAt ? { deletedAt } : {}),
  };
}

async function expectPath(path: string) {
  await waitFor(() => {
    expect(screen.getByTestId("location").textContent).toBe(path);
  });
}

describe("sorteio soft-deleted some das telas", () => {
  beforeEach(async () => {
    await clearDatabase();
    useLoginStore.setState({
      twitchAccessToken: null,
      driveCode: null,
      sessionExpired: false,
    });
    localStorage.removeItem("stream-drops-settings");
  });

  afterEach(() => {
    cleanup();
    useLoginStore.setState({
      twitchAccessToken: null,
      driveCode: null,
      sessionExpired: false,
    });
  });

  it("listas escondem, detalhe e edição redirecionam, e abrir não grava", async () => {
    await putRaw("chat-giveaways", [
      chat("chat-ativo", "Chat ativo"),
      chat("chat-apagado", "Chat apagado", DELETED_AT),
    ]);
    await putRaw("channel-points-giveaways", [
      points("points-ativo", "Pontos ativo"),
      points("points-apagado", "Pontos apagado", DELETED_AT),
    ]);
    await putRaw("giveaways", [
      subscriber("sub-ativo", "Subs ativo"),
      subscriber("sub-apagado", "Subs apagado", DELETED_AT),
    ]);

    const before = await dumpDatabase();
    const storageBefore = storageSnapshot();
    const spy = installWriteSpy();

    try {
      const chatList = renderAt("/dashboard/chat-giveaway");
      expect(await screen.findByText("Chat ativo")).toBeTruthy();
      expect(screen.queryByText("Chat apagado")).toBeNull();
      await expectPath("/dashboard/chat-giveaway");
      chatList.unmount();

      const pointsList = renderAt("/dashboard/channel-points-giveaway");
      expect(await screen.findByText("Pontos ativo")).toBeTruthy();
      expect(screen.queryByText("Pontos apagado")).toBeNull();
      pointsList.unmount();

      const subList = renderAt("/dashboard/follower-giveaway");
      expect(await screen.findByText("Subs ativo")).toBeTruthy();
      expect(screen.queryByText("Subs apagado")).toBeNull();
      subList.unmount();

      const chatDetail = renderAt("/dashboard/chat-giveaway/chat-apagado");
      await expectPath("/dashboard");
      expect(await screen.findByRole("heading", { name: "Dashboard" })).toBeTruthy();
      chatDetail.unmount();

      const chatActive = renderAt("/dashboard/chat-giveaway/chat-ativo");
      expect(await screen.findByRole("heading", { name: "Chat ativo" })).toBeTruthy();
      await expectPath("/dashboard/chat-giveaway/chat-ativo");
      chatActive.unmount();

      const chatEdit = renderAt("/dashboard/chat-giveaway/chat-apagado/edit");
      await expectPath("/dashboard/chat-giveaway");
      expect(await screen.findByText("Chat ativo")).toBeTruthy();
      expect(screen.queryByText("Chat apagado")).toBeNull();
      chatEdit.unmount();

      const pointsDetail = renderAt("/dashboard/channel-points-giveaway/points-apagado");
      await expectPath("/dashboard/channel-points-giveaway");
      pointsDetail.unmount();

      const pointsActive = renderAt("/dashboard/channel-points-giveaway/points-ativo");
      expect(await screen.findByRole("heading", { name: "Pontos ativo" })).toBeTruthy();
      await expectPath("/dashboard/channel-points-giveaway/points-ativo");
      pointsActive.unmount();

      const pointsEdit = renderAt("/dashboard/channel-points-giveaway/points-apagado/edit");
      await expectPath("/dashboard/channel-points-giveaway");
      pointsEdit.unmount();

      const subDetail = renderAt("/dashboard/follower-giveaway/sub-apagado");
      await expectPath("/dashboard/follower-giveaway");
      subDetail.unmount();

      const subActive = renderAt("/dashboard/follower-giveaway/sub-ativo");
      expect(await screen.findByRole("heading", { name: "Subs ativo" })).toBeTruthy();
      await expectPath("/dashboard/follower-giveaway/sub-ativo");
      subActive.unmount();

      const subEdit = renderAt("/dashboard/follower-giveaway/sub-apagado/edit");
      await expectPath("/dashboard/follower-giveaway");
      subEdit.unmount();

      const subEditActive = renderAt("/dashboard/follower-giveaway/sub-ativo/edit");
      expect(await screen.findByDisplayValue("Subs ativo")).toBeTruthy();
      await expectPath("/dashboard/follower-giveaway/sub-ativo/edit");
      subEditActive.unmount();
    } finally {
      spy.restore();
    }

    expect(spy.writes).toEqual([]);
    expect(spy.readwrite).toEqual([]);
    const after = await dumpDatabase();
    expect(after.version).toBe(12);
    expect(after.body).toBe(before.body);
    expect(storageSnapshot()).toEqual(storageBefore);
    expect(localStorage.getItem("stream-drops-settings")).toBeNull();
    expect(useLoginStore.getState().twitchAccessToken).toBeNull();
  }, 60_000);
});
