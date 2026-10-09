import { ThemeProvider } from "@/components/theme-provider";
import {
  clearDatabase,
  closeDb,
  DATABASE_NAME,
  DATABASE_VERSION,
  openDb,
} from "@/database";
import "@/i18n";
import { localDateTimeToIso } from "@/lib/winner-badges/datetime";
import type { EngineClock } from "@/lib/winner-badges/types";
import { ChannelPointsGiveawayDetail } from "@/pages/channel-points-giveaway/[id]";
import { ChannelPointsGiveawayPage } from "@/pages/channel-points-giveaway";
import { ChatGiveawayDetail } from "@/pages/chat-giveaway/[id]";
import { ChatGiveaway } from "@/pages/chat-giveaway";
import { DashboardPage } from "@/pages/dashboard";
import { FollowerGiveawayId } from "@/pages/follower-giveaway/[id]";
import { FollowerGiveaway } from "@/pages/follower-giveaway";
import { RouletteDetailPage } from "@/pages/roulette/[id]";
import { RoulettePage } from "@/pages/roulette";
import { SettingsPage } from "@/pages/settings";
import { SubathonLayout } from "@/pages/subathon/layout";
import { SubathonListPage } from "@/pages/subathon";
import { useLoginStore } from "@/storage/login";
import { useSettingsStore } from "@/storage/settings";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router";
import { afterEach, describe, expect, it } from "vitest";
import fixture from "./fixtures/main-1ffb8ea-upgrade.json";

/**
 * Dados gravados pela UI da main (1ffb8ea) no IndexedDB v12.
 * A homolog também é v12, com as mesmas stores. Abrir as telas
 * não pode apagar nem reescrever esses registros.
 */
const FIXTURE = fixture as {
  version: number;
  stores: Record<string, unknown[]>;
  localStorage: Record<string, string>;
};

const TZ = "America/Sao_Paulo";
const CLOCK: EngineClock = {
  now: localDateTimeToIso(
    { year: 2026, month: 10, day: 15, hour: 12, minute: 0, second: 0 },
    TZ,
  )!,
  timeZone: TZ,
};

function rowKey(row: unknown): string {
  if (!row || typeof row !== "object") return JSON.stringify(row);
  const record = row as Record<string, unknown>;
  return String(record.id ?? record.twitchUserId ?? record.username ?? "");
}

function stable(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(stable);
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.keys(value as object)
        .sort()
        .map((key) => [key, stable((value as Record<string, unknown>)[key])]),
    );
  }
  return value;
}

function normalize(stores: Record<string, unknown[]>): string {
  const names = Object.keys(stores).sort();
  const body: Record<string, unknown[]> = {};
  for (const name of names) {
    body[name] = [...stores[name]]
      .sort((left, right) => rowKey(left).localeCompare(rowKey(right)))
      .map((row) => stable(row));
  }
  return JSON.stringify(body);
}

async function seedMainDatabase(): Promise<void> {
  await clearDatabase();
  const db = await openDb();
  await new Promise<void>((resolve, reject) => {
    const names = Object.keys(FIXTURE.stores);
    const tx = db.transaction(names, "readwrite");
    for (const name of names) {
      const store = tx.objectStore(name);
      for (const record of FIXTURE.stores[name]) store.add(record);
    }
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error);
  });
  if (db.version !== FIXTURE.version) {
    throw new Error(`versão ${db.version}, fixture espera ${FIXTURE.version}`);
  }
}

function installFixtureStorage(): void {
  useLoginStore.setState({
    twitchAccessToken: null,
    driveCode: null,
    sessionExpired: false,
  });
  useSettingsStore.setState({ badges: { enabled: true } });
  localStorage.clear();
  sessionStorage.clear();
  for (const [key, value] of Object.entries(FIXTURE.localStorage)) {
    localStorage.setItem(key, value);
  }
}

async function readStores(): Promise<{ version: number; body: string }> {
  closeDb();
  const db = await new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open(DATABASE_NAME);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
  const names = [...db.objectStoreNames];
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
  const version = db.version;
  db.close();
  return { version, body: normalize(stores) };
}

function storageBody(): string {
  const keys = Object.keys(localStorage).sort();
  return JSON.stringify(keys.map((key) => [key, localStorage.getItem(key)]));
}

function renderAt(path: string) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  render(
    <QueryClientProvider client={client}>
      <ThemeProvider defaultTheme="dark" storageKey="vite-ui-theme">
        <MemoryRouter initialEntries={[path]}>
          <Routes>
            <Route
              path="/dashboard"
              element={<DashboardPage clock={CLOCK} />}
            />
            <Route path="/dashboard/chat-giveaway" element={<ChatGiveaway />} />
            <Route
              path="/dashboard/chat-giveaway/:id"
              element={<ChatGiveawayDetail />}
            />
            <Route
              path="/dashboard/channel-points-giveaway"
              element={<ChannelPointsGiveawayPage />}
            />
            <Route
              path="/dashboard/channel-points-giveaway/:id"
              element={<ChannelPointsGiveawayDetail />}
            />
            <Route
              path="/dashboard/follower-giveaway"
              element={<FollowerGiveaway />}
            />
            <Route
              path="/dashboard/follower-giveaway/:id"
              element={<FollowerGiveawayId />}
            />
            <Route path="/dashboard/roulette" element={<RoulettePage />} />
            <Route
              path="/dashboard/roulette/:id"
              element={<RouletteDetailPage />}
            />
            <Route path="/dashboard/settings" element={<SettingsPage />} />
            <Route path="/dashboard/subathon" element={<SubathonLayout />}>
              <Route index element={<SubathonListPage />} />
            </Route>
          </Routes>
        </MemoryRouter>
      </ThemeProvider>
    </QueryClientProvider>,
  );
}

async function show(path: string, text: string) {
  cleanup();
  document.body.replaceChildren();
  renderAt(path);
  const matches = await screen.findAllByText(
    text,
    { exact: false },
    { timeout: 15000 },
  );
  expect(matches.length).toBeGreaterThan(0);
}

const expectedBody = normalize(FIXTURE.stores);
const expectedStorage = storageSnapshotFrom(FIXTURE.localStorage);

function storageSnapshotFrom(values: Record<string, string>): string {
  return JSON.stringify(
    Object.keys(values)
      .sort()
      .map((key) => [key, values[key]]),
  );
}

describe("upgrade dos dados da main", () => {
  afterEach(async () => {
    cleanup();
    document.body.replaceChildren();
    localStorage.clear();
    sessionStorage.clear();
    useLoginStore.setState({
      twitchAccessToken: null,
      driveCode: null,
      sessionExpired: false,
    });
    await clearDatabase();
  });

  it("mantém o IndexedDB v12 da main ao abrir as telas da homolog", async () => {
    expect(DATABASE_VERSION).toBe(12);
    expect(FIXTURE.version).toBe(12);
    await seedMainDatabase();
    installFixtureStorage();
    const seeded = await readStores();
    expect(seeded.version).toBe(12);
    expect(seeded.body).toBe(expectedBody);

    const chatDrawn = FIXTURE.stores["chat-giveaways"].find(
      (row) => (row as { title?: string }).title === "Chat da madrugada",
    ) as { id: string };
    const chatPending = FIXTURE.stores["chat-giveaways"].find(
      (row) => (row as { title?: string }).title === "Chat sem vencedor",
    ) as { id: string };
    const points = FIXTURE.stores["channel-points-giveaways"][0] as {
      id: string;
    };
    const subs = FIXTURE.stores.giveaways.find(
      (row) => (row as { title?: string }).title === "Subs com vencedor",
    ) as { id: string };
    const roulette = FIXTURE.stores.roulettes[0] as { id: string };

    await show("/dashboard", "madrugada Tier 1");
    expect((await readStores()).body).toBe(expectedBody);
    expect(storageBody()).toBe(expectedStorage);

    await show("/dashboard/chat-giveaway", "Template da madrugada");
    await show(`/dashboard/chat-giveaway/${chatDrawn.id}`, "Chat da madrugada");
    await show(`/dashboard/chat-giveaway/${chatPending.id}`, "Chat sem vencedor");
    await show("/dashboard/channel-points-giveaway", "Pontos do bau");
    await show(
      `/dashboard/channel-points-giveaway/${points.id}`,
      "Pontos do bau",
    );
    await show("/dashboard/follower-giveaway", "Subs com vencedor");
    await show(`/dashboard/follower-giveaway/${subs.id}`, "Subs com vencedor");
    await show("/dashboard/roulette", "Roleta das skins");
    await show(`/dashboard/roulette/${roulette.id}`, "Faca dourada");
    await show("/dashboard/settings", "Luna1");
    expect(screen.getByText("Kai2")).toBeTruthy();
    await show("/dashboard/subathon", "Copiar URL do overlay");

    const after = await readStores();
    expect(after.version).toBe(12);
    expect(after.body).toBe(expectedBody);
    expect(storageBody()).toBe(expectedStorage);
    expect(localStorage.getItem("login-storage")).toContain("stub-access-token");
    expect(localStorage.getItem("vite-ui-theme")).toBe("dark");
  }, 120_000);
});
