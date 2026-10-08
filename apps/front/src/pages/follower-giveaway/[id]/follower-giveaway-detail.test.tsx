import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter, Route, Routes } from "react-router";
import { Toaster } from "sonner";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import "@/i18n";
import i18n from "@/i18n/i18n";
import { clearDatabase } from "@/database";
import {
  useSubscriptionGiveawayDb,
  type FollowerGiveawayFormData,
} from "@/database/SubscriptionGiveaway";
import {
  useExclusionListDb,
  type ExclusionListItem,
} from "@/database/ExclusionListItem";
import type { BroadcasterSubscriber } from "@/service/twitch/types";
import { FollowerGiveawayId } from "./index";

const sentChatMessages: string[] = [];
const drawnPools: BroadcasterSubscriber[][] = [];
const drawnResults: BroadcasterSubscriber[][] = [];

vi.mock("@/service/giveaway", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/service/giveaway")>();
  return {
    ...actual,
    getGiveawayResult: (
      params: Parameters<typeof actual.getGiveawayResult>[0],
    ) => {
      const result = actual.getGiveawayResult(params);
      drawnPools.push(params.participants);
      drawnResults.push(result);
      return result;
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
        return { isOk: () => true, isErr: () => false, value: {} };
      },
    },
    isTokenValid: true,
    isLoading: false,
    isError: false,
    error: null,
    invalidateUserData: () => undefined,
    getUserByLogin: async () => ({ isOk: () => false, isErr: () => true }),
  }),
}));

/* eslint-disable react-hooks/rules-of-hooks */
const { addGiveaway, getGiveaway } = useSubscriptionGiveawayDb();
const { addExclusion, deleteExclusionByUsername } = useExclusionListDb();
/* eslint-enable react-hooks/rules-of-hooks */

function subscriber(userId: string, userName: string): BroadcasterSubscriber {
  return {
    broadcaster_id: "b1",
    broadcaster_login: "canal",
    broadcaster_name: "Canal",
    gifter_id: "",
    gifter_login: "",
    is_gift: false,
    plan_name: "Tier 1",
    tier: "1000",
    user_id: userId,
    user_name: userName,
    user_login: userId,
  };
}

function giveaway(
  id: string,
  participants: BroadcasterSubscriber[],
  winners: BroadcasterSubscriber[] = [],
): FollowerGiveawayFormData {
  return {
    id,
    title: "Sorteio de Subscribers",
    description: "Snapshot",
    subscriptionRequirement: 1000,
    subscriberMultiplier: { "1000": 1, "2000": 1, "3000": 1 },
    participants,
    winners,
    spreadsheetUrl: null,
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
    giveawayWrites: () => writes.filter((write) => write.store === "giveaways"),
    restore() {
      proto.put = originalPut;
      proto.add = originalAdd;
      proto.delete = originalDelete;
    },
  };
}

function dumpStorage(storage: Storage) {
  const data: Record<string, string> = {};
  for (let index = 0; index < storage.length; index += 1) {
    const key = storage.key(index);
    if (key) {
      data[key] = storage.getItem(key) ?? "";
    }
  }
  return data;
}

function participantCountText() {
  const label = screen.getByText("Total de participantes");
  const card = label.parentElement;
  if (!card) {
    throw new Error("card de participantes ausente");
  }
  return card.textContent ?? "";
}

function renderDetail(id: string) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <Toaster />
      <MemoryRouter initialEntries={[`/dashboard/follower-giveaway/${id}`]}>
        <Routes>
          <Route
            path="/dashboard/follower-giveaway/:id"
            element={<FollowerGiveawayId />}
          />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

function drawButton() {
  return screen.getByRole("button", { name: "Sortear" });
}

describe("página do sorteio de Subscribers", () => {
  beforeEach(async () => {
    await i18n.changeLanguage("pt-BR");
    await clearDatabase();
    sentChatMessages.length = 0;
    drawnPools.length = 0;
    drawnResults.length = 0;
    vi.spyOn(Math, "random").mockReturnValue(0);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("CA-B2: excluído depois do snapshot sai da lista, da contagem e da chance", async () => {
    const id = "ca-b2";
    const mira = subscriber("mira", "Mira");
    const ana = subscriber("ana", "Ana");
    await addGiveaway(giveaway(id, [mira, ana]));
    renderDetail(id);

    expect(await screen.findByText("Mira")).toBeTruthy();
    expect(await screen.findByText("Ana", {}, { timeout: 2000 })).toBeTruthy();
    expect(participantCountText()).toContain("2");

    await addExclusion(exclusion("mira", "mira", "Mira"));
    fireEvent.click(drawButton());

    await waitFor(() => {
      expect(sentChatMessages.at(-1)).toContain("@Ana");
    });

    expect(drawnPools.at(-1)?.map((item) => item.user_id)).toEqual(["ana"]);
    expect(sentChatMessages.at(-1)).toContain("@Ana");
    expect(sentChatMessages.at(-1)).toContain("100.0000%");
    expect(sentChatMessages.at(-1)).toContain("Tickets: 1");
    expect(sentChatMessages.at(-1)).not.toContain("Mira");

    await waitFor(() => {
      expect(screen.queryByText("Mira")).toBeNull();
    });
    expect(participantCountText()).toContain("1");
    expect(screen.getAllByText("Ana").length).toBeGreaterThan(0);

    const stored = await getGiveaway(id);
    expect(stored?.participants.map((item) => item.user_id)).toEqual([
      "mira",
      "ana",
    ]);
  });

  it("CA-B4: sai da exclusão, volta na lista e pode ser sorteado sem recoletar", async () => {
    const id = "ca-b4-subs";
    const mira = subscriber("mira", "Mira");
    const ana = subscriber("ana", "Ana");
    await addGiveaway(giveaway(id, [mira, ana]));
    await addExclusion(exclusion("mira", "mira", "Mira"));
    const tracker = trackStoreWrites();

    try {
      renderDetail(id);
      expect(await screen.findByText("Ana")).toBeTruthy();
      await waitFor(() => {
        expect(screen.queryByText("Mira")).toBeNull();
      });
      expect(participantCountText()).toContain("1");

      await deleteExclusionByUsername("mira");
      document.dispatchEvent(new Event("visibilitychange"));

      expect(await screen.findByText("Mira")).toBeTruthy();
      expect(participantCountText()).toContain("2");

      fireEvent.click(drawButton());
      await waitFor(() => {
        expect(sentChatMessages.at(-1)).toContain("@Mira");
      });

      expect(drawnPools.at(-1)?.map((item) => item.user_id)).toEqual([
        "mira",
        "ana",
      ]);
      expect(sentChatMessages.at(-1)).toContain("@Mira");
      expect(sentChatMessages.at(-1)).toContain("50.0000%");
    } finally {
      tracker.restore();
    }
  });

  it("CA-B5: sortear mantém o snapshot intacto e só grava winners", async () => {
    const id = "ca-b5-subs";
    const mira = subscriber("mira", "Mira");
    const ana = subscriber("ana", "Ana");
    await addGiveaway(giveaway(id, [mira, ana]));
    await addExclusion(exclusion("mira", "mira", "Mira"));
    const before = await getGiveaway(id);
    const tracker = trackStoreWrites();
    const localBefore = dumpStorage(localStorage);
    const sessionBefore = dumpStorage(sessionStorage);

    try {
      renderDetail(id);
      await screen.findByText("Ana");
      await waitFor(() => {
        expect(screen.queryByText("Mira")).toBeNull();
      });

      fireEvent.click(drawButton());

      await waitFor(async () => {
        const stored = await getGiveaway(id);
        expect(stored?.winners).toHaveLength(1);
      });

      const after = await getGiveaway(id);
      expect(JSON.stringify(after?.participants)).toBe(
        JSON.stringify(before?.participants),
      );
      expect(after?.participants).toEqual(before?.participants);
      expect(after?.winners.map((item) => item.user_id)).toEqual(["ana"]);
      expect(after?.spreadsheetUrl).toBeNull();
      expect(after?.subscriptionRequirement).toBe(1000);
      const { winners: winnersBefore, ...restBefore } = before ?? {
        winners: [],
      };
      const { winners: winnersAfter, ...restAfter } = after ?? { winners: [] };
      expect(restAfter).toEqual(restBefore);
      expect(winnersBefore).toEqual([]);
      expect(winnersAfter.map((item) => item.user_id)).toEqual(["ana"]);
      expect(tracker.giveawayWrites()).toEqual([
        { op: "put", store: "giveaways" },
      ]);
      expect(
        tracker.writes.filter((write) => write.store === "exclusion-list"),
      ).toEqual([]);
      expect(dumpStorage(localStorage)).toEqual(localBefore);
      expect(dumpStorage(sessionStorage)).toEqual(sessionBefore);
    } finally {
      tracker.restore();
    }
  });

  it("CA-B6: todos excluídos não chama o sorteio, não grava e não erra", async () => {
    const id = "ca-b6-excluded";
    const mira = subscriber("mira", "Mira");
    await addGiveaway(giveaway(id, [mira]));
    await addExclusion(exclusion("mira", "mira", "Mira"));
    const before = await getGiveaway(id);
    const tracker = trackStoreWrites();
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});

    try {
      renderDetail(id);
      expect(
        await screen.findByText("Nenhum participante encontrado."),
      ).toBeTruthy();
      const button = drawButton() as HTMLButtonElement;
      expect(button.disabled).toBe(true);
      consoleError.mockClear();

      button.disabled = false;
      fireEvent.click(button);
      await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 50));
      });

      expect(drawnPools).toEqual([]);
      expect(tracker.giveawayWrites()).toEqual([]);
      expect(consoleError).not.toHaveBeenCalled();
      expect(await getGiveaway(id)).toEqual(before);
    } finally {
      consoleError.mockRestore();
      tracker.restore();
    }
  });

  it("CA-B6: pool vazio porque já ganharam não chama getGiveawayResult", async () => {
    const id = "ca-b6-winners";
    const ana = subscriber("ana", "Ana");
    const bruno = subscriber("bruno", "Bruno");
    await addGiveaway(giveaway(id, [ana, bruno], [ana, bruno]));
    const before = await getGiveaway(id);
    const tracker = trackStoreWrites();
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});

    try {
      renderDetail(id);
      expect((await screen.findAllByText("Ana")).length).toBeGreaterThan(0);
      expect(screen.getAllByText("Bruno").length).toBeGreaterThan(0);
      const button = drawButton() as HTMLButtonElement;
      expect(button.disabled).toBe(false);
      consoleError.mockClear();

      fireEvent.click(button);

      expect(
        await screen.findByText("Nenhum participante encontrado."),
      ).toBeTruthy();
      expect(drawnPools).toEqual([]);
      expect(tracker.giveawayWrites()).toEqual([]);
      expect(consoleError).not.toHaveBeenCalled();
      expect(await getGiveaway(id)).toEqual(before);
      expect(screen.getByRole("heading", { name: "Sorteio de Subscribers" })).toBeTruthy();
    } finally {
      consoleError.mockRestore();
      tracker.restore();
    }
  });

  it("CA-B7: visibilitychange atualiza a lista e a contagem", async () => {
    const id = "ca-b7-subs";
    const mira = subscriber("mira", "Mira");
    const ana = subscriber("ana", "Ana");
    await addGiveaway(giveaway(id, [mira, ana]));
    const tracker = trackStoreWrites();

    try {
      renderDetail(id);
      expect(await screen.findByText("Mira")).toBeTruthy();
      expect(participantCountText()).toContain("2");

      await addExclusion(exclusion("mira", "mira", "Mira"));
      expect(screen.getByText("Mira")).toBeTruthy();

      document.dispatchEvent(new Event("visibilitychange"));

      await waitFor(() => {
        expect(screen.queryByText("Mira")).toBeNull();
      });
      expect(screen.getByText("Ana")).toBeTruthy();
      expect(participantCountText()).toContain("1");
      expect(drawnPools).toEqual([]);
      expect(tracker.giveawayWrites()).toEqual([]);
    } finally {
      tracker.restore();
    }
  });

  it("CA-B9: exclusão vazia mantém resultado, chance e a escrita de hoje", async () => {
    const id = "ca-b9-subs";
    const ana = subscriber("ana", "Ana");
    const bruno = subscriber("bruno", "Bruno");
    await addGiveaway(giveaway(id, [ana, bruno]));
    const before = await getGiveaway(id);
    const tracker = trackStoreWrites();

    try {
      renderDetail(id);
      expect(await screen.findByText("Ana")).toBeTruthy();
      expect(screen.getByText("Bruno")).toBeTruthy();
      expect(participantCountText()).toContain("2");

      fireEvent.click(drawButton());

      await waitFor(() => {
        expect(sentChatMessages.at(-1)).toContain("50.0000%");
      });

      expect(drawnPools.at(-1)?.map((item) => item.user_id)).toEqual([
        "ana",
        "bruno",
      ]);
      expect(sentChatMessages.at(-1)).toBe(
        "Parabéns @Ana! Você ganhou o sorteio! (Chance: 50.0000%, Tickets: 1)",
      );

      const after = await getGiveaway(id);
      expect(after?.participants).toEqual(before?.participants);
      expect(after?.winners.map((item) => item.user_id)).toEqual(["ana"]);
      expect({ ...after, winners: before?.winners }).toEqual(before);
      expect(tracker.giveawayWrites()).toEqual([
        { op: "put", store: "giveaways" },
      ]);
    } finally {
      tracker.restore();
    }
  });
});

describe("palco do sorteio de Subscribers", () => {
  beforeEach(async () => {
    await i18n.changeLanguage("pt-BR");
    await clearDatabase();
    sentChatMessages.length = 0;
    drawnPools.length = 0;
    drawnResults.length = 0;
  });

  it("mostra o vencedor novo e Continuar só fecha", async () => {
    const id = "subs-palco";
    const previous = subscriber("velho", "Velho");
    const nina = subscriber("nina", "Nina91");
    const bruno = subscriber("bruno", "Bruno");
    await addGiveaway(giveaway(id, [nina, bruno, previous], [previous]));
    const tracker = trackStoreWrites();

    try {
      renderDetail(id);
      expect(
        await screen.findByRole("heading", { name: "Sorteio de Subscribers" }),
      ).toBeTruthy();
      expect(tracker.giveawayWrites()).toEqual([]);

      fireEvent.click(screen.getByRole("button", { name: "Sortear" }));

      const stage = await screen.findByRole("dialog", {}, { timeout: 4000 });
      const newest = drawnResults.at(-1)?.[0];
      expect(newest).toBeTruthy();
      expect(newest?.user_id).not.toBe(previous.user_id);
      expect(stage.getAttribute("aria-labelledby")).toBeTruthy();
      expect(
        screen.getByRole("dialog", { name: newest?.user_name }),
      ).toBeTruthy();
      expect(screen.queryByRole("button", { name: "Cancelar" })).toBeNull();
      expect(screen.queryByRole("button", { name: "Refazer" })).toBeNull();
      expect(screen.getByRole("button", { name: "Continuar" })).toBeTruthy();
      expect(screen.getByText("Já salvo neste navegador")).toBeTruthy();
      await act(async () => {
        await new Promise<void>((resolve) => {
          requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
        });
      });

      await waitFor(async () => {
        const stored = await getGiveaway(id);
        expect(stored?.winners[0]?.user_id).toBe(newest?.user_id);
      });
      const saved = await getGiveaway(id);
      expect(saved?.winners.map((winner) => winner.user_id)).toEqual([
        newest?.user_id,
        previous.user_id,
      ]);
      expect(tracker.giveawayWrites()).toEqual([
        { op: "put", store: "giveaways" },
      ]);

      fireEvent.click(screen.getByRole("button", { name: "Continuar" }));
      await waitFor(() => {
        expect(screen.queryByRole("dialog")).toBeNull();
      }, { timeout: 4000 });

      expect(await getGiveaway(id)).toEqual(saved);
      expect(tracker.giveawayWrites()).toEqual([
        { op: "put", store: "giveaways" },
      ]);
    } finally {
      tracker.restore();
    }
  });
});
