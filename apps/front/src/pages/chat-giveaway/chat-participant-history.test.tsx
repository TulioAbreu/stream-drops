import { act, fireEvent, render, renderHook, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter, Route, Routes } from "react-router";
import type tmi from "tmi.js";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import "@/i18n";
import i18n from "@/i18n/i18n";
import { clearDatabase, openDb } from "@/database";
import {
  useChatGiveawayDb,
  type ChatGiveawayFormData,
  type ChatGiveawayWinner,
} from "@/database/ChatGiveaway";
import { useExclusionListDb, type ExclusionListItem } from "@/database/ExclusionListItem";
import {
  addChatParticipantRows,
  getChatParticipantsByGiveaway,
  type ChatParticipantRecord,
} from "@/database/chat-participants";
import type { ChatParticipant } from "./types";
import {
  setChatListenerTestOverrides,
  useChatListener,
  type ChatListenerClient,
} from "./hooks/use-chat-listener";
import { ChatGiveawayDetail } from "./[id]/index";

const sentChatMessages: string[] = [];
const drawnPools: ChatParticipant[][] = [];

vi.mock("@/service/chat-giveaway", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/service/chat-giveaway")>();
  return {
    ...actual,
    drawWinner: (params: { participants: ChatParticipant[] }) => {
      drawnPools.push(params.participants);
      return actual.drawWinner(params as Parameters<typeof actual.drawWinner>[0]);
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
      sendChatMessage: async (params: { message: string }) => {
        sentChatMessages.push(params.message);
        return { isOk: () => true, isErr: () => false, value: { data: [] } };
      },
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
    },
    isTokenValid: true,
    getUserByLogin: async () => ({ isOk: () => false, isErr: () => true }),
    isLoading: false,
    isError: false,
    error: null,
    invalidateUserData: () => undefined,
  }),
}));

/* eslint-disable react-hooks/rules-of-hooks */
const { addChatGiveaway, getChatGiveaway } = useChatGiveawayDb();
const { addExclusion } = useExclusionListDb();
/* eslint-enable react-hooks/rules-of-hooks */

const bus: {
  emit: (userstate: tmi.ChatUserstate, message: string, self?: boolean) => void;
} = { emit: () => undefined };

function createFakeClient(): ChatListenerClient {
  const listeners = new Map<string, Array<(...args: unknown[]) => void>>();
  const client: ChatListenerClient = {
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
  bus.emit = (userstate, message, self = false) => {
    listeners.get("message")?.forEach((listener) => {
      listener("#streamer", userstate, message, self);
    });
  };
  return client;
}

function userstate(
  id: string,
  username: string,
  displayName = username,
): tmi.ChatUserstate {
  return {
    id: `msg-${id}`,
    "user-id": id,
    username,
    "display-name": displayName,
    subscriber: false,
  } as tmi.ChatUserstate;
}

function person(id: string, displayName: string, joinedAt = 1): ChatParticipant {
  return {
    id,
    name: id,
    displayName,
    avatar: "https://example.com/a.png",
    subscriber: false,
    joinedAt,
  };
}

function giveaway(
  id: string,
  participants: ChatParticipant[] = [],
  winners: ChatGiveawayWinner[] = [],
): ChatGiveawayFormData {
  return {
    id,
    title: "Sorteio S4b",
    description: "ao vivo",
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

function exclusion(id: string, username: string, displayName: string): ExclusionListItem {
  return {
    twitchUserId: id,
    username,
    displayName,
    profileImageUrl: "",
    updatedAt: "2026-01-01T00:00:00.000Z",
  };
}

function renderDetail(id: string) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[`/dashboard/chat-giveaway/${id}`]}>
        <Routes>
          <Route path="/dashboard/chat-giveaway/:id" element={<ChatGiveawayDetail />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

async function ready() {
  await screen.findByRole("heading", { name: "Sorteio S4b" });
  await screen.findByText("Conectado");
}

function drawButton() {
  return screen.getByRole("button", { name: /Sortear Vencedor/ });
}

async function emitMany(count: number, prefix: string) {
  for (let index = 0; index < count; index += 1) {
    const id = `${prefix}-${index}`;
    await act(async () => {
      bus.emit(userstate(id, id, `Pessoa ${id}`), "!join");
    });
  }
}

function stamp(rows: ChatParticipantRecord[]) {
  return rows
    .map((row) => [row.userId, row.joinedAt, row.id] as const)
    .sort((left, right) => left[0].localeCompare(right[0]));
}

describe("histórico de participação do Chat", () => {
  beforeEach(async () => {
    await i18n.changeLanguage("pt-BR");
    await clearDatabase();
    sentChatMessages.length = 0;
    drawnPools.length = 0;
    setChatListenerTestOverrides({
      createClient: () => createFakeClient(),
      batchMaxWaitMs: 0,
      persistIntervalMs: 0,
    });
  });

  afterEach(() => {
    setChatListenerTestOverrides(null);
    vi.restoreAllMocks();
  });

  it("CA-D1: 30 elegíveis sem vencedor continuam no store depois de recarregar", async () => {
    const id = "ca-d1";
    const seeded = giveaway(id);
    await addChatGiveaway(seeded);
    const view = renderDetail(id);
    await ready();

    await emitMany(30, "elig");

    await waitFor(async () => {
      expect(await getChatParticipantsByGiveaway(id)).toHaveLength(30);
    }, { timeout: 8000 });

    const first = await getChatParticipantsByGiveaway(id);
    expect(new Set(first.map((row) => row.giveawayId))).toEqual(new Set([id]));
    expect(first.every((row) => row.id === `${id}:${row.userId}`)).toBe(true);
    expect(first.every((row) => row.userId && row.joinedAt > 0)).toBe(true);

    view.unmount();
    expect(stamp(await getChatParticipantsByGiveaway(id))).toEqual(stamp(first));

    renderDetail(id);
    await ready();
    expect(stamp(await getChatParticipantsByGiveaway(id))).toEqual(stamp(first));
    expect(await getChatGiveaway(id)).toEqual(seeded);
    expect((await openDb()).version).toBe(12);
  }, 20000);

  it("CA-D2: 200 entradas não alteram o registro do sorteio", async () => {
    const id = "ca-d2";
    const seeded = giveaway(
      id,
      [person("saved-viewer", "Salvo", 50)],
      [
        {
          id: "winner-a",
          name: "Winner A",
          twitchId: "winner-a",
          avatar: "https://example.com/w.png",
          drawnAt: "2026-03-01T00:00:00.000Z",
        },
      ],
    );
    await addChatGiveaway(seeded);
    const before = await getChatGiveaway(id);

    const readwrites: string[] = [];
    const originalTransaction = IDBDatabase.prototype.transaction;
    IDBDatabase.prototype.transaction = function (
      this: IDBDatabase,
      storeNames: string | string[],
      mode?: IDBTransactionMode,
      options?: IDBTransactionOptions,
    ) {
      if (mode === "readwrite") {
        const names = Array.isArray(storeNames) ? storeNames.join(",") : String(storeNames);
        readwrites.push(names);
      }
      return originalTransaction.call(this, storeNames, mode, options);
    };

    try {
      renderDetail(id);
      await ready();
      await emitMany(200, "burst");

      await waitFor(async () => {
        expect(await getChatParticipantsByGiveaway(id)).toHaveLength(200);
      }, { timeout: 15000 });
    } finally {
      IDBDatabase.prototype.transaction = originalTransaction;
    }

    const after = await getChatGiveaway(id);
    expect(after).toEqual(before);
    expect(JSON.stringify(after)).toBe(JSON.stringify(before));
    expect(readwrites.every((names) => names === "chat-participants")).toBe(true);
    expect(readwrites.length).toBeGreaterThan(0);
  }, 30000);

  it("CA-D3: mudar o critério não troca o joinedAt nem apaga a linha", async () => {
    const id = "ca-d3";
    const hook = renderHook(
      (props: { keyword: string }) =>
        useChatListener({
          channel: "streamer",
          keyword: props.keyword,
          broadcasterId: "broadcaster-1",
          giveawayId: id,
        }),
      { initialProps: { keyword: "!join" } },
    );

    await waitFor(() => {
      expect(hook.result.current.connectionStatus).toBe("connected");
    });

    await act(async () => {
      bus.emit(userstate("viewer", "viewer", "Viewer"), "!join");
    });

    await waitFor(async () => {
      expect(await getChatParticipantsByGiveaway(id)).toHaveLength(1);
    });
    const t1 = (await getChatParticipantsByGiveaway(id))[0]?.joinedAt;
    expect(t1).toBeGreaterThan(0);

    hook.rerender({ keyword: "nao-entra" });
    await waitFor(() => {
      expect(hook.result.current.allParticipants).toEqual([]);
    });
    expect((await getChatParticipantsByGiveaway(id))[0]?.joinedAt).toBe(t1);

    hook.rerender({ keyword: "!join" });
    await waitFor(() => {
      expect(hook.result.current.allParticipants.map((item) => item.id)).toEqual(["viewer"]);
    });

    const rows = await getChatParticipantsByGiveaway(id);
    expect(rows).toHaveLength(1);
    expect(rows[0]?.joinedAt).toBe(t1);
    expect(hook.result.current.allParticipants[0]?.joinedAt).not.toBe(t1);

    await act(async () => {
      hook.result.current.clearParticipants();
    });
    expect(hook.result.current.allParticipants).toEqual([]);
    expect((await getChatParticipantsByGiveaway(id))[0]?.joinedAt).toBe(t1);
  });

  it("CA-D4: filtro de nome ativo ainda grava quem não aparece", async () => {
    const id = "ca-d4";
    await addChatGiveaway(giveaway(id));
    renderDetail(id);
    await ready();

    fireEvent.change(screen.getByRole("textbox", { name: "Filtrar por nome..." }), {
      target: { value: "ana" },
    });
    await act(async () => {
      bus.emit(userstate("bruno", "bruno", "Bruno"), "!join");
    });

    expect(await screen.findByText("0 encontrados (de 1 elegíveis)")).toBeTruthy();
    expect(screen.queryByText("Bruno")).toBeNull();

    await waitFor(async () => {
      const rows = await getChatParticipantsByGiveaway(id);
      expect(rows.map((row) => row.userId)).toEqual(["bruno"]);
    });
    expect((await getChatGiveaway(id))?.participants).toEqual([]);
  });

  it("CA-D5: cota estourada não para a coleta nem o sorteio, e o lote é retentado", async () => {
    const id = "ca-d5";
    const seeded = giveaway(id);
    await addChatGiveaway(seeded);
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const originalAdd = IDBObjectStore.prototype.add;
    let failQuota = true;
    IDBObjectStore.prototype.add = function (
      this: IDBObjectStore,
      ...args: Parameters<IDBObjectStore["add"]>
    ) {
      if (failQuota && this.name === "chat-participants") {
        throw new DOMException(
          "The quota has been exceeded.",
          "QuotaExceededError",
        );
      }
      return originalAdd.apply(this, args);
    };

    try {
      renderDetail(id);
      await ready();
      await act(async () => {
        bus.emit(userstate("ana", "ana", "Ana"), "!join");
      });
      await act(async () => {
        bus.emit(userstate("bruno", "bruno", "Bruno"), "!join");
      });

      expect(await screen.findByText("Ana")).toBeTruthy();
      expect(screen.getByText("Bruno")).toBeTruthy();
      expect(await getChatParticipantsByGiveaway(id)).toEqual([]);

      fireEvent.click(drawButton());
      await waitFor(() => {
        expect(drawnPools.length).toBeGreaterThan(0);
      }, { timeout: 4000 });

      const pool = drawnPools.at(-1) ?? [];
      expect(pool.map((item) => item.id).sort()).toEqual(["ana", "bruno"]);
      expect(await getChatParticipantsByGiveaway(id)).toEqual([]);
      expect(await getChatGiveaway(id)).toEqual(seeded);
      expect(
        warn.mock.calls.some((call) => String(call[0]).includes("participações do chat")),
      ).toBe(true);

      failQuota = false;
      await act(async () => {
        bus.emit(userstate("carla", "carla", "Carla"), "!join");
      });

      await waitFor(async () => {
        expect(await getChatParticipantsByGiveaway(id)).toHaveLength(3);
      }, { timeout: 8000 });

      const rows = await getChatParticipantsByGiveaway(id);
      expect(rows.map((row) => row.userId).sort()).toEqual(["ana", "bruno", "carla"]);
      expect(screen.getByText("3 participantes elegíveis")).toBeTruthy();
    } finally {
      IDBObjectStore.prototype.add = originalAdd;
    }
  }, 20000);

  it("CA-D34: excluído e broadcaster não ganham linha; exclusão posterior não apaga", async () => {
    const id = "ca-d34";
    await addExclusion(exclusion("mod", "modbot", "Mod Bot"));
    await addChatGiveaway(
      giveaway(id, [person("mod", "Mod Bot", 4), person("ana", "Ana", 8)]),
    );
    const db = await openDb();
    const kept: ChatParticipantRecord = {
      id: `${id}:mod`,
      giveawayId: id,
      userId: "mod",
      name: "modbot",
      displayName: "Mod Bot",
      avatar: "https://example.com/mod.png",
      subscriber: false,
      joinedAt: 4,
    };
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction("chat-participants", "readwrite");
      tx.objectStore("chat-participants").add(kept);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });

    renderDetail(id);
    await waitFor(() => {
      expect(screen.getByText("1 participantes elegíveis")).toBeTruthy();
    });
    expect(screen.queryByText("Mod Bot")).toBeNull();

    await act(async () => {
      bus.emit(userstate("mod", "modbot", "Mod Bot"), "!join");
    });
    await act(async () => {
      bus.emit(userstate("broadcaster-1", "streamer", "Streamer"), "!join");
    });
    await act(async () => {
      bus.emit(userstate("not-the-id", "streamer", "Outro Login"), "!join");
    });
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 40));
    });
    expect(screen.getByText("1 participantes elegíveis")).toBeTruthy();
    expect(screen.queryByText("Mod Bot")).toBeNull();
    expect(screen.queryByText("Streamer")).toBeNull();

    await act(async () => {
      bus.emit(userstate("bruno", "bruno", "Bruno"), "!join");
    });

    await waitFor(async () => {
      const rows = await getChatParticipantsByGiveaway(id);
      expect(rows.map((row) => row.userId).sort()).toEqual(["bruno", "mod"]);
    });
    expect(screen.getByText("Bruno")).toBeTruthy();
    expect(screen.queryByText("Streamer")).toBeNull();

    const bruno = (await getChatParticipantsByGiveaway(id)).find((row) => row.userId === "bruno");
    expect(bruno?.joinedAt).toBeGreaterThan(0);

    await addExclusion(exclusion("bruno", "bruno", "Bruno"));
    document.dispatchEvent(new Event("visibilitychange"));

    await waitFor(() => {
      expect(screen.queryByText("Bruno")).toBeNull();
    });

    const after = await getChatParticipantsByGiveaway(id);
    expect(after.find((row) => row.userId === "mod")).toEqual(kept);
    expect(after.find((row) => row.userId === "bruno")?.joinedAt).toBe(bruno?.joinedAt);
    expect(after).toHaveLength(2);
    expect((await getChatGiveaway(id))?.participants?.map((item) => item.id).sort()).toEqual([
      "ana",
      "mod",
    ]);
  });

  it("pagehide e unmount gravam o lote que ainda espera o intervalo", async () => {
    const hiddenId = "ca-hide";
    const hidden = renderHook(() =>
      useChatListener({
        channel: "streamer",
        keyword: "!join",
        broadcasterId: "broadcaster-1",
        giveawayId: hiddenId,
      }),
    );
    await waitFor(() => {
      expect(hidden.result.current.connectionStatus).toBe("connected");
    });
    await act(async () => {
      bus.emit(userstate("hide-user", "hide", "Hide"), "!join");
    });
    await waitFor(async () => {
      expect(await getChatParticipantsByGiveaway(hiddenId)).toHaveLength(1);
    });

    setChatListenerTestOverrides({
      createClient: () => createFakeClient(),
      batchMaxWaitMs: 0,
      persistIntervalMs: 60_000,
    });
    await act(async () => {
      bus.emit(userstate("later-user", "later", "Later"), "!join");
    });
    await waitFor(() => {
      expect(hidden.result.current.allParticipants.map((item) => item.id)).toEqual([
        "hide-user",
        "later-user",
      ]);
    });
    expect((await getChatParticipantsByGiveaway(hiddenId)).map((row) => row.userId)).toEqual([
      "hide-user",
    ]);

    await act(async () => {
      window.dispatchEvent(new Event("pagehide"));
    });
    await waitFor(async () => {
      expect(
        (await getChatParticipantsByGiveaway(hiddenId)).map((row) => row.userId).sort(),
      ).toEqual(["hide-user", "later-user"]);
    });
    hidden.unmount();

    setChatListenerTestOverrides({
      createClient: () => createFakeClient(),
      batchMaxWaitMs: 0,
      persistIntervalMs: 0,
    });
    const unmountId = "ca-unmount";
    const leaving = renderHook(() =>
      useChatListener({
        channel: "streamer",
        keyword: "!join",
        broadcasterId: "broadcaster-1",
        giveawayId: unmountId,
      }),
    );
    await waitFor(() => {
      expect(leaving.result.current.connectionStatus).toBe("connected");
    });
    await act(async () => {
      bus.emit(userstate("bye-user", "bye", "Bye"), "!join");
    });
    await waitFor(async () => {
      expect(await getChatParticipantsByGiveaway(unmountId)).toHaveLength(1);
    });

    setChatListenerTestOverrides({
      createClient: () => createFakeClient(),
      batchMaxWaitMs: 0,
      persistIntervalMs: 60_000,
    });
    await act(async () => {
      bus.emit(userstate("bye-later", "bye-later", "Bye Later"), "!join");
    });
    await waitFor(() => {
      expect(leaving.result.current.allParticipants).toHaveLength(2);
    });
    expect(await getChatParticipantsByGiveaway(unmountId)).toHaveLength(1);
    leaving.unmount();
    await waitFor(async () => {
      expect(await getChatParticipantsByGiveaway(unmountId)).toHaveLength(2);
    });
  });

  it("corrida na página: confirmar não perde o winners quando um lote grava", async () => {
    const id = "ca-race-page";
    await addChatGiveaway(giveaway(id));
    renderDetail(id);
    await ready();
    await act(async () => {
      bus.emit(userstate("ana", "ana", "Ana"), "!join");
    });
    await waitFor(async () => {
      expect(await getChatParticipantsByGiveaway(id)).toHaveLength(1);
    });

    const extra: ChatParticipantRecord = {
      id: `${id}:extra`,
      giveawayId: id,
      userId: "extra",
      name: "extra",
      displayName: "Extra",
      avatar: "https://example.com/extra.png",
      subscriber: false,
      joinedAt: 77,
    };

    let batch: Promise<unknown> = Promise.resolve();
    const puts: ChatGiveawayFormData[] = [];
    const originalPut = IDBObjectStore.prototype.put;
    IDBObjectStore.prototype.put = function (
      this: IDBObjectStore,
      ...args: Parameters<IDBObjectStore["put"]>
    ) {
      if (this.name === "chat-giveaways") {
        puts.push(structuredClone(args[0]) as ChatGiveawayFormData);
        batch = addChatParticipantRows([extra]);
      }
      return originalPut.apply(this, args);
    };

    try {
      fireEvent.click(drawButton());
      await screen.findByRole("button", { name: "Confirmar" }, { timeout: 4000 });
      await waitFor(() => {
        const button = screen.getByRole("button", {
          name: "Confirmar",
        }) as HTMLButtonElement;
        fireEvent.click(button);
        expect(button.disabled).toBe(true);
      }, { timeout: 4000 });
      await waitFor(async () => {
        expect((await getChatGiveaway(id))?.winners).toHaveLength(1);
      });
      await batch;
    } finally {
      IDBObjectStore.prototype.put = originalPut;
    }

    const stored = await getChatGiveaway(id);
    expect(puts).toHaveLength(1);
    expect(stored?.winners).toEqual(puts[0]?.winners);
    expect(stored?.winners).toHaveLength(1);
    expect(stored?.winners[0]?.twitchId).toBe("ana");
    const rows = await getChatParticipantsByGiveaway(id);
    expect(rows.map((row) => row.userId).sort()).toEqual(["ana", "extra"]);
  });
});
