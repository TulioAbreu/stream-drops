import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter, Route, Routes } from "react-router";
import { Toaster } from "sonner";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import "@/i18n";
import i18n from "@/i18n/i18n";
import { clearDatabase } from "@/database";
import {
  useChannelPointsGiveawayDb,
  type ChannelPointsGiveawayFormData,
  type ChannelPointsParticipant,
  type ChannelPointsWinner,
} from "@/database/ChannelPointsGiveaway";
import {
  useExclusionListDb,
  type ExclusionListItem,
} from "@/database/ExclusionListItem";
import { ChannelPointsGiveawayDetail } from "./index";

const sentChatMessages: string[] = [];
const drawnPools: ChannelPointsParticipant[][] = [];
const settleCalls: ChannelPointsParticipant[][] = [];
const drawnCalls: Array<{
  params: {
    participants: ChannelPointsParticipant[];
    excludeRedemptionIds?: string[];
  };
  result: {
    participant: ChannelPointsParticipant;
    redemptionId: string;
  } | null;
}> = [];

vi.mock("@/pages/channel-points-giveaway/hooks/use-chat-messages", () => ({
  useChatMessages: () => ({
    messages: [],
    connectionStatus: "disconnected",
  }),
}));

vi.mock("@/service/channel-points-giveaway", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("@/service/channel-points-giveaway")>();
  return {
    ...actual,
    drawChannelPointsWinner: (
      params: Parameters<typeof actual.drawChannelPointsWinner>[0],
    ) => {
      const result = actual.drawChannelPointsWinner(params);
      drawnPools.push(params.participants);
      drawnCalls.push({
        params: {
          participants: params.participants,
          excludeRedemptionIds: params.excludeRedemptionIds,
        },
        result,
      });
      return result;
    },
  };
});

vi.mock("@/usecase/settle-channel-points-on-close", () => ({
  settleChannelPointsOnClose: async (params: {
    participants: ChannelPointsParticipant[];
  }) => {
    settleCalls.push(
      params.participants.map((participant) => ({
        ...participant,
        tickets: participant.tickets.map((ticket) => ({ ...ticket })),
      })),
    );
    return {
      isOk: () => true,
      isErr: () => false,
      value: { settledCount: params.participants.length },
    };
  },
}));

vi.mock("@/hooks/use-twitch-api", () => ({
  useTwitchApi: () => ({
    userData: {
      id: "broadcaster-1",
      login: "streamer",
      displayName: "Streamer",
      profileImageUrl: "",
      expiresIn: 3600,
      broadcasterType: "partner",
      scopes: ["channel:manage:redemptions"],
    },
    twitchApiClient: {
      sendChatMessage: async (params: { message: string }) => {
        sentChatMessages.push(params.message);
        return { isOk: () => true, isErr: () => false, value: {} };
      },
      deleteCustomReward: async () => ({
        isOk: () => true,
        isErr: () => false,
        value: {},
      }),
    },
    isTokenValid: true,
    isLoading: false,
    isError: false,
    error: null,
    invalidateUserData: () => undefined,
  }),
}));

/* eslint-disable react-hooks/rules-of-hooks */
const { addChannelPointsGiveaway, getChannelPointsGiveaway } =
  useChannelPointsGiveawayDb();
const { addExclusion, deleteExclusionByUsername } = useExclusionListDb();
/* eslint-enable react-hooks/rules-of-hooks */

function participant(
  userId: string,
  displayName: string,
  options?: { subscriber?: boolean; tier?: 1000 | 2000 | 3000 | null; tickets?: number },
): ChannelPointsParticipant {
  const tickets = options?.tickets ?? 1;
  return {
    userId,
    name: userId,
    displayName,
    avatar: "https://example.com/a.png",
    subscriber: options?.subscriber ?? false,
    tier: options?.tier ?? null,
    tickets: Array.from({ length: tickets }, (_, index) => ({
      redemptionId: `${userId}-ticket-${index}`,
      redeemedAt: "2026-01-01T00:00:00.000Z",
    })),
  };
}

function giveaway(
  id: string,
  participants: ChannelPointsParticipant[],
  winners: ChannelPointsWinner[] = [],
): ChannelPointsGiveawayFormData {
  return {
    id,
    title: "Sorteio de Pontos",
    description: "",
    cost: 100,
    rewardId: "reward-1",
    rewardEnabled: true,
    maxPerStream: null,
    subscribersOnly: false,
    subscriptionRequirement: 0,
    subscriberMultiplier: { "1000": 1, "2000": 1, "3000": 3 },
    refundIneligible: false,
    allowMultipleWins: false,
    status: "ready",
    participants,
    winners,
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

function winner(
  userId: string,
  name: string,
  redemptionId: string,
): ChannelPointsWinner {
  return {
    id: `winner-${userId}`,
    userId,
    name,
    avatar: "https://example.com/a.png",
    redemptionId,
    drawnAt: "2026-01-02T00:00:00.000Z",
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
    giveawayWrites: () =>
      writes.filter((write) => write.store === "channel-points-giveaways"),
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

function renderDetail(id: string) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <Toaster />
      <MemoryRouter initialEntries={[`/dashboard/channel-points-giveaway/${id}`]}>
        <Routes>
          <Route
            path="/dashboard/channel-points-giveaway/:id"
            element={<ChannelPointsGiveawayDetail />}
          />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

function drawButton() {
  return screen.getByRole("button", { name: "Sortear Vencedor" });
}

async function flushFrames() {
  await act(async () => {
    await new Promise<void>((resolve) => {
      requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
    });
  });
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

describe("página do sorteio de Pontos", () => {
  beforeEach(async () => {
    await i18n.changeLanguage("pt-BR");
    await clearDatabase();
    sentChatMessages.length = 0;
    drawnPools.length = 0;
    drawnCalls.length = 0;
    settleCalls.length = 0;
    vi.spyOn(Math, "random").mockReturnValue(0);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("CA-B1: excluído depois da coleta sai da lista, da contagem e da chance", async () => {
    const id = "ca-b1";
    const mira = participant("mira", "Mira", {
      subscriber: true,
      tier: 3000,
      tickets: 1,
    });
    const ana = participant("ana", "Ana");
    await addChannelPointsGiveaway(giveaway(id, [mira, ana]));
    renderDetail(id);

    expect(await screen.findByText("2 tickets")).toBeTruthy();
    expect(document.body.innerText).toContain(
      "2 tickets disponíveis para sorteio",
    );
    expect(document.body.innerText).toContain(
      "4 entradas no pool (com multiplicador)",
    );
    expect(screen.getAllByText("Mira").length).toBeGreaterThan(0);
    expect(screen.getByText("Ana")).toBeTruthy();

    await addExclusion(exclusion("mira", "mira", "Mira"));
    fireEvent.click(drawButton());

    await waitFor(() => {
      expect(drawnPools.length).toBeGreaterThan(0);
    }, { timeout: 4000 });

    const pool = drawnPools.at(-1) ?? [];
    expect(pool.map((item) => item.userId)).toEqual(["ana"]);
    expect(sentChatMessages.at(-1)).toContain("@Ana");
    expect(sentChatMessages.at(-1)).toContain("100.0000%");
    expect(sentChatMessages.at(-1)).not.toContain("Mira");

    await waitFor(() => {
      expect(screen.queryByText("Mira")).toBeNull();
    });
    expect(screen.getAllByText("Ana").length).toBeGreaterThan(0);
    expect(screen.getByText("1 tickets")).toBeTruthy();
    expect(document.body.innerText).toContain(
      "1 tickets disponíveis para sorteio",
    );
    expect(document.body.innerText).not.toContain(
      "4 entradas no pool (com multiplicador)",
    );

    const stored = await getChannelPointsGiveaway(id);
    expect(stored?.participants.map((item) => item.userId)).toEqual([
      "mira",
      "ana",
    ]);
  });

  it("CA-B3: re-sorteio não pode sair quem entrou na exclusão no meio", async () => {
    const id = "ca-b3";
    const ana = participant("ana", "Ana");
    const bruno = participant("bruno", "Bruno");
    const mira = participant("mira", "Mira");
    await addChannelPointsGiveaway(giveaway(id, [ana, bruno, mira]));
    renderDetail(id);
    await screen.findByText("Ana");

    fireEvent.click(drawButton());
    await screen.findByRole("button", { name: "Confirmar" }, {
      timeout: 4000,
    });
    expect(screen.getByRole("dialog").textContent).toContain("Ana");

    await addExclusion(exclusion("mira", "mira", "Mira"));
    vi.mocked(Math.random).mockReturnValue(0.999);
    fireEvent.click(screen.getByRole("button", { name: "Refazer" }));

    await waitFor(() => {
      expect(screen.getByRole("dialog").textContent).toContain("Bruno");
    }, { timeout: 4000 });

    const pool = drawnPools.at(-1) ?? [];
    expect(pool.map((item) => item.userId)).toEqual(["ana", "bruno"]);
    expect(pool.map((item) => item.userId)).not.toContain("mira");
    expect(sentChatMessages.at(-1)).toContain("@Bruno");
    expect(sentChatMessages.at(-1)).toContain("100.0000%");
    expect(sentChatMessages.at(-1)).not.toContain("Mira");
    expect(screen.queryByText("Mira")).toBeNull();
  });

  it("CA-B4: sai da exclusão, volta na lista e pode ser sorteado sem recoletar", async () => {
    const id = "ca-b4";
    const mira = participant("mira", "Mira");
    const ana = participant("ana", "Ana");
    await addChannelPointsGiveaway(giveaway(id, [mira, ana]));
    await addExclusion(exclusion("mira", "mira", "Mira"));
    const tracker = trackStoreWrites();

    try {
      renderDetail(id);
      expect(await screen.findByText("Ana")).toBeTruthy();
      expect(screen.queryByText("Mira")).toBeNull();
      expect(screen.getByText("1 tickets")).toBeTruthy();

      await deleteExclusionByUsername("mira");
      document.dispatchEvent(new Event("visibilitychange"));

      expect(await screen.findByText("Mira")).toBeTruthy();
      expect(screen.getByText("2 tickets")).toBeTruthy();

      fireEvent.click(drawButton());
      await waitFor(() => {
        expect(drawnPools.length).toBeGreaterThan(0);
      }, { timeout: 4000 });

      expect(drawnPools.at(-1)?.map((item) => item.userId)).toEqual([
        "mira",
        "ana",
      ]);
      expect(sentChatMessages.at(-1)).toContain("@Mira");
      expect(tracker.giveawayWrites()).toEqual([]);

      const stored = await getChannelPointsGiveaway(id);
      expect(stored?.participants).toEqual([mira, ana]);
      expect(stored?.winners).toEqual([]);
    } finally {
      tracker.restore();
    }
  });

  it("CA-B5: sortear e confirmar mantém participants intacto no disco", async () => {
    const id = "ca-b5";
    const mira = participant("mira", "Mira", { tickets: 2 });
    const ana = participant("ana", "Ana");
    await addChannelPointsGiveaway(giveaway(id, [mira, ana]));
    await addExclusion(exclusion("mira", "mira", "Mira"));
    const before = await getChannelPointsGiveaway(id);
    const tracker = trackStoreWrites();
    const localBefore = dumpStorage(localStorage);
    const sessionBefore = dumpStorage(sessionStorage);

    try {
      renderDetail(id);
      await screen.findByText("Ana");
      expect(screen.queryByText("Mira")).toBeNull();

      fireEvent.click(drawButton());
      await confirmWinner();

      await waitFor(async () => {
        const stored = await getChannelPointsGiveaway(id);
        expect(stored?.winners).toHaveLength(1);
      });

      const after = await getChannelPointsGiveaway(id);
      expect(JSON.stringify(after?.participants)).toBe(
        JSON.stringify(before?.participants),
      );
      expect(after?.participants).toEqual(before?.participants);
      expect(after?.winners.map((item) => item.userId)).toEqual(["ana"]);
      expect(after?.status).toBe("ready");
      expect(after?.rewardId).toBe(before?.rewardId);
      expect(tracker.giveawayWrites()).toEqual([
        { op: "put", store: "channel-points-giveaways" },
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

  it("CA-B6: sem elegíveis mostra o aviso, não grava e não erra no console", async () => {
    const id = "ca-b6-excluded";
    const mira = participant("mira", "Mira");
    await addChannelPointsGiveaway(giveaway(id, [mira]));
    await addExclusion(exclusion("mira", "mira", "Mira"));
    const before = await getChannelPointsGiveaway(id);
    const tracker = trackStoreWrites();
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});

    try {
      renderDetail(id);
      expect(
        await screen.findByText("Nenhum participante elegível"),
      ).toBeTruthy();
      const button = drawButton() as HTMLButtonElement;
      expect(button.disabled).toBe(true);
      consoleError.mockClear();

      fireEvent.click(button);
      await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 700));
      });

      expect(drawnPools).toEqual([]);
      expect(tracker.giveawayWrites()).toEqual([]);
      expect(consoleError).not.toHaveBeenCalled();
      expect(await getChannelPointsGiveaway(id)).toEqual(before);
    } finally {
      consoleError.mockRestore();
      tracker.restore();
    }
  });

  it("CA-B6: já vencedor não é sorteado de novo e não quebra", async () => {
    const id = "ca-b6-winners";
    const ana = participant("ana", "Ana");
    const seeded = giveaway(id, [ana], [
      winner("ana", "Ana", ana.tickets[0].redemptionId),
    ]);
    await addChannelPointsGiveaway(seeded);
    const before = await getChannelPointsGiveaway(id);
    const tracker = trackStoreWrites();
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});

    try {
      renderDetail(id);
      expect((await screen.findAllByText("Ana")).length).toBeGreaterThan(0);
      expect(document.body.innerText).toContain(
        "0 tickets disponíveis para sorteio",
      );
      const button = drawButton() as HTMLButtonElement;
      expect(button.disabled).toBe(true);
      consoleError.mockClear();

      fireEvent.click(button);
      await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 700));
      });

      expect(drawnPools).toEqual([]);
      expect(tracker.giveawayWrites()).toEqual([]);
      expect(consoleError).not.toHaveBeenCalled();
      expect(await getChannelPointsGiveaway(id)).toEqual(before);
    } finally {
      consoleError.mockRestore();
      tracker.restore();
    }
  });

  it("CA-B7: visibilitychange atualiza a lista e as contagens", async () => {
    const id = "ca-b7";
    const mira = participant("mira", "Mira", { tickets: 2 });
    const ana = participant("ana", "Ana");
    await addChannelPointsGiveaway(giveaway(id, [mira, ana]));
    const tracker = trackStoreWrites();

    try {
      renderDetail(id);
      expect(await screen.findByText("3 tickets")).toBeTruthy();
      expect(screen.getAllByText("Mira").length).toBeGreaterThan(0);

      await addExclusion(exclusion("mira", "mira", "Mira"));
      expect(screen.getAllByText("Mira").length).toBeGreaterThan(0);

      document.dispatchEvent(new Event("visibilitychange"));

      await waitFor(() => {
        expect(screen.queryByText("Mira")).toBeNull();
      });
      expect(screen.getByText("Ana")).toBeTruthy();
      expect(screen.getByText("1 tickets")).toBeTruthy();
      expect(screen.getByText("1 tickets disponíveis para sorteio")).toBeTruthy();
      expect(drawnPools).toEqual([]);
      expect(tracker.giveawayWrites()).toEqual([]);
    } finally {
      tracker.restore();
    }
  });

  it("CA-B8: encerrar liquida os resgates de todos, inclusive o excluído", async () => {
    const id = "ca-b8";
    const mira = participant("mira", "Mira", { tickets: 2 });
    const ana = participant("ana", "Ana");
    const seeded = giveaway(id, [mira, ana]);
    await addChannelPointsGiveaway(seeded);
    await addExclusion(exclusion("mira", "mira", "Mira"));
    renderDetail(id);

    expect(await screen.findByText("Ana")).toBeTruthy();
    await waitFor(() => {
      expect(screen.queryByText("Mira")).toBeNull();
    });

    fireEvent.click(screen.getByRole("button", { name: "Encerrar sorteio" }));
    expect(await screen.findByText("Encerrar sorteio?")).toBeTruthy();
    const confirmClose = screen
      .getAllByRole("button", { name: "Encerrar sorteio" })
      .at(-1);
    if (!confirmClose) {
      throw new Error("botão de confirmar encerramento ausente");
    }
    fireEvent.click(confirmClose);

    await waitFor(() => {
      expect(settleCalls.length).toBe(1);
    });

    expect(settleCalls[0]).toEqual(seeded.participants);
    expect(settleCalls[0]?.map((item) => item.userId)).toEqual(["mira", "ana"]);
    expect(
      await screen.findByText("Sorteio encerrado e item removido da loja"),
    ).toBeTruthy();
  });

  it("CA-B9: exclusão vazia mantém pool, chance e a escrita de hoje", async () => {
    const id = "ca-b9";
    const ana = participant("ana", "Ana");
    const bruno = participant("bruno", "Bruno");
    const seeded = giveaway(id, [ana, bruno]);
    await addChannelPointsGiveaway(seeded);
    const before = await getChannelPointsGiveaway(id);
    const tracker = trackStoreWrites();

    try {
      renderDetail(id);
      expect(await screen.findByText("Ana")).toBeTruthy();
      expect(screen.getByText("Bruno")).toBeTruthy();
      expect(screen.getByText("2 tickets")).toBeTruthy();
      expect(screen.getByText("2 tickets disponíveis para sorteio")).toBeTruthy();

      fireEvent.click(drawButton());
      await confirmWinner();

      await waitFor(async () => {
        const stored = await getChannelPointsGiveaway(id);
        expect(stored?.winners).toHaveLength(1);
      });

      expect(drawnPools.at(-1)?.map((item) => item.userId)).toEqual([
        "ana",
        "bruno",
      ]);
      expect(sentChatMessages.at(-1)).toContain("@Ana");
      expect(sentChatMessages.at(-1)).toContain("50.0000%");

      const after = await getChannelPointsGiveaway(id);
      expect(after?.participants).toEqual(before?.participants);
      expect(after?.winners.map((item) => item.userId)).toEqual(["ana"]);
      expect(after?.status).toBe("ready");
      expect(tracker.giveawayWrites()).toEqual([
        { op: "put", store: "channel-points-giveaways" },
      ]);
    } finally {
      tracker.restore();
    }
  });

  it("confirmar, cancelar e refazer seguem os handlers do sorteio", async () => {
    const id = "pontos-palco";
    const seeded = giveaway(id, [
      participant("ana", "Ana"),
      participant("bruno", "Bruno"),
    ]);
    await addChannelPointsGiveaway(seeded);
    const tracker = trackStoreWrites();

    try {
      renderDetail(id);
      expect(
        await screen.findByRole("heading", { name: "Sorteio de Pontos" }),
      ).toBeTruthy();

      const before = drawnCalls.length;
      fireEvent.click(drawButton());
      await waitFor(() => {
        expect(drawnCalls.length).toBe(before + 1);
        expect(screen.getByRole("dialog")).toBeTruthy();
      }, { timeout: 4000 });
      await flushFrames();

      const cancelled = drawnCalls[0]?.result;
      expect(cancelled).toBeTruthy();
      expect(drawnCalls[0]?.params.excludeRedemptionIds ?? []).toEqual([]);
      expect(
        screen.getByRole("dialog", { name: cancelled?.participant.displayName }),
      ).toBeTruthy();
      expect(screen.getByRole("button", { name: "Cancelar" })).toBeTruthy();
      expect(screen.getByRole("button", { name: "Refazer" })).toBeTruthy();
      expect(screen.getByRole("button", { name: "Confirmar" })).toBeTruthy();

      fireEvent.click(screen.getByRole("button", { name: "Cancelar" }));
      await waitFor(() => {
        expect(screen.queryByRole("dialog")).toBeNull();
      }, { timeout: 4000 });
      expect(await getChannelPointsGiveaway(id)).toEqual(seeded);
      expect(tracker.writes).toEqual([]);

      fireEvent.click(drawButton());
      await waitFor(() => {
        expect(drawnCalls.length).toBe(before + 2);
        expect(screen.getByRole("dialog")).toBeTruthy();
      }, { timeout: 4000 });
      await flushFrames();
      const beforeRedraw = drawnCalls.at(-1);
      expect(beforeRedraw?.result).toBeTruthy();

      fireEvent.click(screen.getByRole("button", { name: "Refazer" }));
      await waitFor(() => {
        expect(drawnCalls.length).toBeGreaterThan(2);
        expect(
          screen.getByRole("dialog", {
            name: drawnCalls.at(-1)?.result?.participant.displayName,
          }),
        ).toBeTruthy();
      }, { timeout: 4000 });
      const redraw = drawnCalls.at(-1);
      expect(redraw?.params.excludeRedemptionIds).toContain(
        beforeRedraw?.result?.redemptionId,
      );
      expect(redraw?.params.participants.map((item) => item.userId).sort()).toEqual([
        "ana",
        "bruno",
      ]);
      expect(await getChannelPointsGiveaway(id)).toEqual(seeded);

      fireEvent.click(screen.getByRole("button", { name: "Confirmar" }));

      await waitFor(async () => {
        const stored = await getChannelPointsGiveaway(id);
        expect(stored?.winners).toHaveLength(1);
      }, { timeout: 4000 });

      const stored = await getChannelPointsGiveaway(id);
      const winner = stored?.winners[0];
      expect(winner?.userId).toBe(redraw?.result?.participant.userId);
      expect(winner?.name).toBe(redraw?.result?.participant.displayName);
      expect(winner?.avatar).toBe(redraw?.result?.participant.avatar);
      expect(winner?.redemptionId).toBe(redraw?.result?.redemptionId);
      expect(winner?.drawnAt).toBeTruthy();
      expect(stored?.participants).toEqual(seeded.participants);
      expect(
        tracker.writes.filter((write) => write.store === "channel-points-giveaways"),
      ).toEqual([{ op: "put", store: "channel-points-giveaways" }]);
    } finally {
      tracker.restore();
    }
  });

  it("com o filtro ativo, o sorteio usa todos os elegíveis", async () => {
    const id = "pontos-filtro";
    await addChannelPointsGiveaway(
      giveaway(id, [
        participant("ana-1", "Ana Um"),
        participant("ana-2", "Ana Dois"),
        participant("bruno", "Bruno"),
      ]),
    );
    renderDetail(id);
    expect(
      await screen.findByRole("heading", { name: "Sorteio de Pontos" }),
    ).toBeTruthy();
    expect(screen.getByText("Bruno")).toBeTruthy();

    fireEvent.change(screen.getByRole("textbox", { name: "Filtrar por nome..." }), {
      target: { value: "ana" },
    });

    expect(screen.getByText("2 encontrados (de 3 participantes)")).toBeTruthy();
    expect(
      screen.getByText(
        "O sorteio considera todos os elegíveis, não só os filtrados",
      ),
    ).toBeTruthy();
    expect(screen.getByText("Ana Um")).toBeTruthy();
    expect(screen.getByText("Ana Dois")).toBeTruthy();
    expect(screen.queryByText("Bruno")).toBeNull();

    fireEvent.click(drawButton());
    await waitFor(() => {
      expect(drawnCalls.length).toBe(1);
    }, { timeout: 4000 });

    expect(drawnCalls[0]?.params.participants.map((item) => item.userId)).toEqual([
      "ana-1",
      "ana-2",
      "bruno",
    ]);
    expect(drawnCalls[0]?.params.excludeRedemptionIds ?? []).toEqual([]);
  });
});
