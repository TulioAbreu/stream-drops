import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter, Route, Routes } from "react-router";
import { beforeEach, describe, expect, it, vi } from "vitest";
import "@/i18n";
import i18n from "@/i18n/i18n";
import { clearDatabase } from "@/database";
import {
  useChannelPointsGiveawayDb,
  type ChannelPointsGiveawayFormData,
  type ChannelPointsParticipant,
} from "@/database/ChannelPointsGiveaway";
import {
  type DrawChannelPointsWinnerParams,
  type DrawChannelPointsWinnerResult,
} from "@/service/channel-points-giveaway";
import { ChannelPointsGiveawayDetail } from "./index";

const drawn = vi.hoisted(() => ({
  calls: [] as Array<{
    params: DrawChannelPointsWinnerParams;
    result: DrawChannelPointsWinnerResult | null;
  }>,
}));

vi.mock("@/service/channel-points-giveaway", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("@/service/channel-points-giveaway")>();
  return {
    ...actual,
    drawChannelPointsWinner: (params: DrawChannelPointsWinnerParams) => {
      const result = actual.drawChannelPointsWinner(params);
      drawn.calls.push({ params, result });
      return result;
    },
  };
});

vi.mock("../hooks/use-chat-messages", () => ({
  useChatMessages: () => ({
    messages: [],
    connectionStatus: "disconnected" as const,
  }),
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
      sendChatMessage: async () => ({
        isOk: () => true,
        isErr: () => false,
        value: { data: [] },
      }),
    },
  }),
}));

// Factories de IndexedDB. O prefixo use* é histórico; não são hooks.
/* eslint-disable react-hooks/rules-of-hooks */
const { addChannelPointsGiveaway, getChannelPointsGiveaway } =
  useChannelPointsGiveawayDb();
/* eslint-enable react-hooks/rules-of-hooks */

function person(
  userId: string,
  displayName: string,
  redemptionId: string,
): ChannelPointsParticipant {
  return {
    userId,
    name: userId,
    displayName,
    avatar: "",
    subscriber: false,
    tier: null,
    tickets: [
      { redemptionId, redeemedAt: "2026-01-01T00:00:00.000Z" },
    ],
  };
}

function giveaway(
  id: string,
  participants: ChannelPointsParticipant[],
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
    subscriberMultiplier: { "1000": 1, "2000": 1, "3000": 1 },
    refundIneligible: false,
    allowMultipleWins: false,
    status: "ready",
    participants,
    winners: [],
    createdAt: "2026-01-01T00:00:00.000Z",
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
      <MemoryRouter
        initialEntries={[`/dashboard/channel-points-giveaway/${id}`]}
      >
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

async function flushFrames() {
  await act(async () => {
    await new Promise<void>((resolve) => {
      requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
    });
  });
}

async function draw() {
  const before = drawn.calls.length;
  fireEvent.click(
    screen.getByRole("button", { name: /Sortear Vencedor/ }),
  );
  await waitFor(() => {
    expect(drawn.calls.length).toBe(before + 1);
    expect(screen.getByRole("dialog")).toBeTruthy();
  }, { timeout: 4000 });
  await flushFrames();
}

describe("Pontos do Canal no palco", () => {
  beforeEach(async () => {
    await i18n.changeLanguage("pt-BR");
    await clearDatabase();
    drawn.calls.length = 0;
  });

  it("confirmar, cancelar e refazer seguem os handlers do sorteio", async () => {
    const id = "pontos-palco";
    const seeded = giveaway(id, [
      person("ana", "Ana", "ticket-ana"),
      person("bruno", "Bruno", "ticket-bruno"),
    ]);
    await addChannelPointsGiveaway(seeded);
    const tracker = trackStoreWrites();

    try {
      renderDetail(id);
      expect(
        await screen.findByRole("heading", { name: "Sorteio de Pontos" }),
      ).toBeTruthy();

      await draw();
      const cancelled = drawn.calls[0]?.result;
      expect(cancelled).toBeTruthy();
      expect(drawn.calls[0]?.params.excludeRedemptionIds ?? []).toEqual([]);
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

      await draw();
      const beforeRedraw = drawn.calls.at(-1);
      expect(beforeRedraw?.result).toBeTruthy();

      fireEvent.click(screen.getByRole("button", { name: "Refazer" }));
      await waitFor(() => {
        expect(drawn.calls.length).toBeGreaterThan(2);
        expect(
          screen.getByRole("dialog", {
            name: drawn.calls.at(-1)?.result?.participant.displayName,
          }),
        ).toBeTruthy();
      }, { timeout: 4000 });
      await flushFrames();
      const redraw = drawn.calls.at(-1);
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
        person("ana-1", "Ana Um", "ticket-ana-1"),
        person("ana-2", "Ana Dois", "ticket-ana-2"),
        person("bruno", "Bruno", "ticket-bruno"),
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

    await draw();

    expect(drawn.calls[0]?.params.participants.map((item) => item.userId)).toEqual([
      "ana-1",
      "ana-2",
      "bruno",
    ]);
    expect(drawn.calls[0]?.params.excludeRedemptionIds ?? []).toEqual([]);
  });
});
