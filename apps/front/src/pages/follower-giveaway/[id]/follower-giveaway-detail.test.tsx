import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter, Route, Routes } from "react-router";
import { beforeEach, describe, expect, it, vi } from "vitest";
import "@/i18n";
import i18n from "@/i18n/i18n";
import { clearDatabase } from "@/database";
import {
  useSubscriptionGiveawayDb,
  type FollowerGiveawayFormData,
} from "@/database/SubscriptionGiveaway";
import type { BroadcasterSubscriber } from "@/service/twitch/types";
import { FollowerGiveawayId } from "./index";

const drawn = vi.hoisted(() => ({
  batches: [] as BroadcasterSubscriber[][],
}));

vi.mock("@/service/giveaway", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/service/giveaway")>();
  return {
    ...actual,
    getGiveawayResult: (
      params: Parameters<typeof actual.getGiveawayResult>[0],
    ) => {
      const result = actual.getGiveawayResult(params);
      drawn.batches.push(result);
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
const { addGiveaway, getGiveaway } = useSubscriptionGiveawayDb();
/* eslint-enable react-hooks/rules-of-hooks */

function subscriber(id: string, name: string): BroadcasterSubscriber {
  return {
    broadcaster_id: "broadcaster-1",
    broadcaster_login: "streamer",
    broadcaster_name: "Streamer",
    gifter_id: "",
    gifter_login: "",
    is_gift: false,
    plan_name: "Tier 1",
    tier: "1000",
    user_id: id,
    user_name: name,
    user_login: id,
  };
}

function giveaway(
  id: string,
  participants: BroadcasterSubscriber[],
  winners: BroadcasterSubscriber[] = [],
): FollowerGiveawayFormData {
  return {
    id,
    title: "Sorteio de Subs",
    description: "",
    subscriptionRequirement: 1000,
    subscriberMultiplier: { "1000": 1, "2000": 1, "3000": 1 },
    participants,
    winners,
    spreadsheetUrl: null,
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
    giveawayWrites: () =>
      writes.filter((write) => write.store === "giveaways"),
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

describe("palco do sorteio de Subscribers", () => {
  beforeEach(async () => {
    await i18n.changeLanguage("pt-BR");
    await clearDatabase();
    drawn.batches.length = 0;
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
        await screen.findByRole("heading", { name: "Sorteio de Subs" }),
      ).toBeTruthy();
      expect(tracker.giveawayWrites()).toEqual([]);

      fireEvent.click(screen.getByRole("button", { name: "Sortear" }));

      const stage = await screen.findByRole("dialog", {}, { timeout: 4000 });
      const newest = drawn.batches.at(-1)?.[0];
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
