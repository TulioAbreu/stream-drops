import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter, Route, Routes } from "react-router";
import type tmi from "tmi.js";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import "@/i18n";
import i18n from "@/i18n/i18n";
import { clearDatabase } from "@/database";
import {
  useChatGiveawayDb,
  type ChatGiveawayFormData,
} from "@/database/ChatGiveaway";
import {
  useExclusionListDb,
  type ExclusionListItem,
} from "@/database/ExclusionListItem";
import type { ChatParticipant } from "../types";
import {
  setChatListenerTestOverrides,
  type ChatListenerClient,
} from "../hooks/use-chat-listener";
import { ChatGiveawayDetail } from "./index";

const sentChatMessages: string[] = [];
const drawnPools: ChatParticipant[][] = [];

vi.mock("@/service/chat-giveaway", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/service/chat-giveaway")>();
  return {
    ...actual,
    drawWinner: (params: { participants: ChatParticipant[] }) => {
      drawnPools.push(params.participants);
      return actual.drawWinner(
        params as Parameters<typeof actual.drawWinner>[0],
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

// Factories de IndexedDB. O prefixo use* é histórico; não são hooks.
/* eslint-disable react-hooks/rules-of-hooks */
const { addChatGiveaway, getChatGiveaway } = useChatGiveawayDb();
const { addExclusion, deleteExclusionByUsername } = useExclusionListDb();
/* eslint-enable react-hooks/rules-of-hooks */

const bus: {
  emit: (
    userstate: tmi.ChatUserstate,
    message: string,
    self?: boolean,
  ) => void;
} = {
  emit: () => undefined,
};

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

function person(
  id: string,
  displayName: string,
  joinedAt = 1,
): ChatParticipant {
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
): ChatGiveawayFormData {
  return {
    id,
    title: "Sorteio S0",
    description: "",
    keyword: "!join",
    cost: 0,
    minimumSuscriptionTimeInMonths: 0,
    subscriberMultiplier: 1,
    subscribersOnly: false,
    winners: [],
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

function trackStoreWrites() {
  const writes: { op: string; store: string }[] = [];
  const proto = IDBObjectStore.prototype;
  const originalPut = proto.put;
  const originalAdd = proto.add;
  const originalDelete = proto.delete;

  proto.put = function (
    this: IDBObjectStore,
    ...args: Parameters<IDBObjectStore["put"]>
  ) {
    writes.push({ op: "put", store: this.name });
    return originalPut.apply(this, args);
  };
  proto.add = function (
    this: IDBObjectStore,
    ...args: Parameters<IDBObjectStore["add"]>
  ) {
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

  return {
    writes,
    giveawayWrites: () => writes.filter((write) => write.store === "chat-giveaways"),
    restore() {
      proto.put = originalPut;
      proto.add = originalAdd;
      proto.delete = originalDelete;
    },
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
          <Route
            path="/dashboard/chat-giveaway/:id"
            element={<ChatGiveawayDetail />}
          />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

async function ready() {
  await screen.findByRole("heading", { name: "Sorteio S0" });
  await screen.findByText((_, element) => {
    const text = element?.textContent?.replace(/\s+/g, " ").trim();
    return element?.tagName === "P" && text === "Envie !join no chat para participar";
  });
  await screen.findByText("Conectado");
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 30));
  });
}

async function say(id: string, username: string, displayName: string) {
  await act(async () => {
    bus.emit(
      {
        id: `msg-${id}`,
        "user-id": id,
        username,
        "display-name": displayName,
        subscriber: false,
      } as tmi.ChatUserstate,
      "!join",
    );
  });
  await screen.findByText(displayName);
}

function filterBox() {
  return screen.getByRole("textbox", { name: "Filtrar por nome..." });
}

function drawButton() {
  return screen.getByRole("button", { name: /Sortear Vencedor/ });
}

async function confirmWinner() {
  await screen.findByRole("button", { name: "Confirmar" }, { timeout: 4000 });
  await waitFor(() => {
    const button = screen.getByRole("button", {
      name: "Confirmar",
    }) as HTMLButtonElement;
    fireEvent.click(button);
    expect(button.disabled).toBe(true);
  }, { timeout: 4000 });
}

describe("página do Chat Giveaway", () => {
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
  });

  it("CA-C1: com filtro ativo, drawWinner e a chance usam os 10 elegíveis", async () => {
    const id = "ca-c1";
    await addChatGiveaway(giveaway(id));
    renderDetail(id);
    await ready();

    const people = [
      ["ana-1", "Ana Um"],
      ["ana-2", "Ana Dois"],
      ["bruno", "Bruno"],
      ["carla", "Carla"],
      ["edu", "Edu"],
      ["fabio", "Fabio"],
      ["guto", "Guto"],
      ["helo", "Helo"],
      ["igor", "Igor"],
      ["joao", "Joao"],
    ] as const;

    for (const [userId, displayName] of people) {
      await say(userId, userId, displayName);
    }

    expect(screen.getByText("10 participantes elegíveis")).toBeTruthy();
    fireEvent.change(filterBox(), { target: { value: "ana" } });

    expect(
      screen.getByText("2 encontrados (de 10 elegíveis)"),
    ).toBeTruthy();
    expect(screen.getByText("Ana Um")).toBeTruthy();
    expect(screen.getByText("Ana Dois")).toBeTruthy();
    expect(screen.queryByText("Bruno")).toBeNull();

    fireEvent.click(drawButton());

    await waitFor(() => {
      expect(drawnPools.length).toBeGreaterThan(0);
    }, { timeout: 4000 });

    const pool = drawnPools.at(-1) ?? [];
    expect(pool.map((item) => item.id).sort()).toEqual(
      people.map(([userId]) => userId).sort(),
    );
    expect(sentChatMessages.at(-1)).toContain("10.0000%");
    expect(sentChatMessages.at(-1)).toContain("Tickets: 1");
  });

  it("CA-C2: confirmar grava a união e não apaga salvos fora do filtro", async () => {
    const id = "ca-c2";
    const saved = [
      person("ana-salva", "Ana Salva", 10),
      person("bruno-salvo", "Bruno Salvo", 20),
      person("carla-salva", "Carla Salva", 30),
    ];
    await addChatGiveaway(giveaway(id, saved));
    const tracker = trackStoreWrites();

    try {
      renderDetail(id);
      await ready();
      await say("ana-live", "ana-live", "Ana Live");
      await say("edu-live", "edu-live", "Edu Live");
      expect(tracker.giveawayWrites()).toEqual([]);

      fireEvent.change(filterBox(), { target: { value: "ana" } });
      expect(screen.getByText("Ana Salva")).toBeTruthy();
      expect(screen.getByText("Ana Live")).toBeTruthy();
      expect(screen.queryByText("Edu Live")).toBeNull();
      expect(screen.queryByText("Bruno Salvo")).toBeNull();

      fireEvent.click(drawButton());
      await confirmWinner();

      await waitFor(async () => {
        const stored = await getChatGiveaway(id);
        expect(stored?.winners).toHaveLength(1);
      });

      const stored = await getChatGiveaway(id);
      expect(stored?.participants?.map((item) => item.id).sort()).toEqual([
        "ana-live",
        "ana-salva",
        "bruno-salvo",
        "carla-salva",
        "edu-live",
      ]);
      expect(
        stored?.participants?.find((item) => item.id === "bruno-salvo")?.joinedAt,
      ).toBe(20);
      expect(tracker.giveawayWrites()).toEqual([
        { op: "put", store: "chat-giveaways" },
      ]);
    } finally {
      tracker.restore();
    }
  });

  it("CA-C3: a contagem distingue filtrados e elegíveis", async () => {
    const id = "ca-c3";
    const people = [
      person("ana-1", "Ana Um"),
      person("ana-2", "Ana Dois"),
      ...Array.from({ length: 8 }, (_, index) =>
        person(`user-${index}`, `Pessoa ${index}`),
      ),
    ];
    await addChatGiveaway(giveaway(id, people));
    renderDetail(id);

    expect(await screen.findByText("10 participantes elegíveis")).toBeTruthy();
    expect(
      screen.queryByText(
        "O sorteio considera todos os elegíveis, não só os filtrados",
      ),
    ).toBeNull();

    fireEvent.change(filterBox(), { target: { value: "ana" } });

    expect(screen.getByText("2 encontrados (de 10 elegíveis)")).toBeTruthy();
    expect(
      screen.getByText(
        "O sorteio considera todos os elegíveis, não só os filtrados",
      ),
    ).toBeTruthy();
    expect(screen.queryByText("Pessoa 0")).toBeNull();
    expect(screen.getByText("Ana Um")).toBeTruthy();
  });

  it("CA-C4: filtro sem resultado deixa a lista vazia e o sorteio habilitado", async () => {
    const id = "ca-c4";
    const people = Array.from({ length: 10 }, (_, index) =>
      person(`user-${index}`, `Pessoa ${index}`),
    );
    await addChatGiveaway(giveaway(id, people));
    renderDetail(id);
    await screen.findByText("10 participantes elegíveis");

    fireEvent.change(filterBox(), { target: { value: "zzzz" } });

    expect(
      screen.getByText("Nenhum participante encontrado para 'zzzz'"),
    ).toBeTruthy();
    expect(drawButton().hasAttribute("disabled")).toBe(false);
  });

  it("CA-C5: abrir e recarregar não grava, o filtro volta vazio e os salvos entram", async () => {
    const id = "ca-c5";
    const people = Array.from({ length: 10 }, (_, index) =>
      person(`user-${index}`, `Pessoa ${index}`, index + 1),
    );
    const seeded = giveaway(id, people);
    await addChatGiveaway(seeded);
    const tracker = trackStoreWrites();

    try {
      const first = renderDetail(id);
      expect(await screen.findByText("10 participantes elegíveis")).toBeTruthy();
      expect(filterBox()).toHaveProperty("value", "");

      fireEvent.change(filterBox(), { target: { value: "pessoa 1" } });
      expect(filterBox()).toHaveProperty("value", "pessoa 1");

      first.unmount();
      renderDetail(id);

      expect(await screen.findByText("10 participantes elegíveis")).toBeTruthy();
      expect(filterBox()).toHaveProperty("value", "");
      expect(tracker.giveawayWrites()).toEqual([]);

      const stored = await getChatGiveaway(id);
      expect(stored).toEqual(seeded);
    } finally {
      tracker.restore();
    }
  });

  it("CA-C7: exclusão noutra aba sai do sorteio e da lista na hora de sortear", async () => {
    const id = "ca-c7";
    await addChatGiveaway(giveaway(id));
    renderDetail(id);
    await ready();
    await say("mod", "modbot", "Mod Bot");
    await say("bruno", "bruno", "Bruno");

    await addExclusion(exclusion("mod", "modbot", "Mod Bot"));
    expect(screen.getByText("Mod Bot")).toBeTruthy();

    fireEvent.click(drawButton());

    await waitFor(() => {
      expect(drawnPools.length).toBeGreaterThan(0);
    }, { timeout: 4000 });

    const pool = drawnPools.at(-1) ?? [];
    expect(pool.map((item) => item.id)).toEqual(["bruno"]);
    await waitFor(() => {
      expect(screen.queryByText("Mod Bot")).toBeNull();
    });
    expect(screen.getAllByText("Bruno").length).toBeGreaterThan(0);
  });

  it("CA-C8: sair da exclusão devolve quem já estava na memória", async () => {
    const id = "ca-c8";
    await addChatGiveaway(giveaway(id));
    renderDetail(id);
    await ready();
    await say("mod", "modbot", "Mod Bot");
    await say("bruno", "bruno", "Bruno");

    await addExclusion(exclusion("mod", "modbot", "Mod Bot"));
    document.dispatchEvent(new Event("visibilitychange"));

    await waitFor(() => {
      expect(screen.queryByText("Mod Bot")).toBeNull();
    });
    expect(screen.getByText("Bruno")).toBeTruthy();
    expect(drawnPools).toEqual([]);

    await deleteExclusionByUsername("modbot");
    document.dispatchEvent(new Event("visibilitychange"));

    expect(await screen.findByText("Mod Bot")).toBeTruthy();
    expect(screen.getByText("Bruno")).toBeTruthy();
    expect(drawnPools).toEqual([]);
  });

  it("CA-C9: broadcaster salvo não aparece e não é sorteável", async () => {
    const id = "ca-c9";
    await addChatGiveaway(
      giveaway(id, [
        person("broadcaster-1", "Canal Dono"),
        person("bruno", "Bruno"),
      ]),
    );
    renderDetail(id);
    await screen.findByText("1 participantes elegíveis");

    expect(screen.queryByText("Canal Dono")).toBeNull();
    expect(screen.getByText("Bruno")).toBeTruthy();

    fireEvent.click(drawButton());
    await waitFor(() => {
      expect(drawnPools.length).toBeGreaterThan(0);
    }, { timeout: 4000 });

    const pool = drawnPools.at(-1) ?? [];
    expect(pool.map((item) => item.id)).toEqual(["bruno"]);
  });

  it("CA-C10: excluído já salvo continua no array e não entra no sorteio", async () => {
    const id = "ca-c10";
    const saved = [
      person("mod", "Mod Bot", 4),
      person("ana", "Ana"),
      person("bruno", "Bruno"),
    ];
    await addChatGiveaway(giveaway(id, saved));
    await addExclusion(exclusion("mod", "modbot", "Mod Bot"));
    const tracker = trackStoreWrites();

    try {
      renderDetail(id);
      await ready();
      expect(await screen.findByText("2 participantes elegíveis")).toBeTruthy();
      expect(screen.queryByText("Mod Bot")).toBeNull();

      await say("edu", "edu", "Edu");
      expect(screen.getByText("3 participantes elegíveis")).toBeTruthy();
      expect(tracker.giveawayWrites()).toEqual([]);

      fireEvent.click(drawButton());
      await waitFor(() => {
        expect(drawnPools.length).toBeGreaterThan(0);
      }, { timeout: 4000 });
      const pool = drawnPools.at(-1) ?? [];
      expect(pool.map((item) => item.id).sort()).toEqual(["ana", "bruno", "edu"]);

      await confirmWinner();
      await waitFor(async () => {
        const stored = await getChatGiveaway(id);
        expect(stored?.winners).toHaveLength(1);
      });

      const stored = await getChatGiveaway(id);
      expect(stored?.participants?.map((item) => item.id).sort()).toEqual([
        "ana",
        "bruno",
        "edu",
        "mod",
      ]);
      expect(stored?.participants?.find((item) => item.id === "mod")?.joinedAt).toBe(4);
      expect(stored?.winners?.some((winner) => winner.twitchId === "mod")).toBe(false);
    } finally {
      tracker.restore();
    }
  });
});
