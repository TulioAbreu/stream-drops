import { clearDatabase, openDb } from "@/database";
import { useChatGiveawayDb } from "@/database/ChatGiveaway";
import { useChannelPointsGiveawayDb } from "@/database/ChannelPointsGiveaway";
import { useSubscriptionGiveawayDb } from "@/database/SubscriptionGiveaway";
import "@/i18n";
import { Toaster } from "sonner";
import { ChannelPointsGiveawayEdit } from "@/pages/channel-points-giveaway/[id]/edit";
import { ChatGiveawayEdit } from "@/pages/chat-giveaway/[id]/edit";
import { EditFollowerGiveawayPage } from "@/pages/follower-giveaway/[id]/edit";
import { useLoginStore } from "@/storage/login";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes, useLocation } from "react-router";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

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
      updateCustomReward: async () => ({
        isOk: () => true,
        isErr: () => false,
        value: {},
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

const DELETED_AT = "2026-10-08T18:00:00.000Z";

function LocationProbe() {
  const location = useLocation();
  return <div data-testid="location">{location.pathname}</div>;
}

function renderAt(path: string, page: React.ReactNode) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={[path]}>
        <Toaster />
        <Routes>
          <Route path="/dashboard/chat-giveaway" element={<><LocationProbe /><p>Lista do chat</p></>} />
          <Route path="/dashboard/chat-giveaway/:id/edit" element={<><LocationProbe />{page}</>} />
          <Route path="/dashboard/chat-giveaway/:id" element={<><LocationProbe /><p>Detalhe do chat</p></>} />
          <Route path="/dashboard/channel-points-giveaway" element={<><LocationProbe /><p>Lista de pontos</p></>} />
          <Route path="/dashboard/channel-points-giveaway/:id/edit" element={<><LocationProbe />{page}</>} />
          <Route path="/dashboard/channel-points-giveaway/:id" element={<><LocationProbe /><p>Detalhe de pontos</p></>} />
          <Route path="/dashboard/follower-giveaway" element={<><LocationProbe /><p>Lista de subs</p></>} />
          <Route path="/dashboard/follower-giveaway/:id/edit" element={<><LocationProbe />{page}</>} />
          <Route path="/dashboard/follower-giveaway/:id" element={<><LocationProbe /><p>Detalhe de subs</p></>} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

async function putRaw(storeName: string, record: unknown) {
  const db = await openDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(storeName, "readwrite");
    tx.objectStore(storeName).put(record);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error);
  });
}

async function readTitle(storeName: string, id: string) {
  const db = await openDb();
  return new Promise<string | undefined>((resolve, reject) => {
    const tx = db.transaction(storeName, "readonly");
    const request = tx.objectStore(storeName).get(id);
    request.onsuccess = () => resolve((request.result as { title?: string } | undefined)?.title);
    request.onerror = () => reject(request.error);
  });
}

describe("update de sorteio já excluído", () => {
  beforeEach(async () => {
    await clearDatabase();
    useLoginStore.setState({
      twitchAccessToken: null,
      driveCode: null,
      sessionExpired: false,
    });
  });

  afterEach(() => {
    cleanup();
    useLoginStore.setState({
      twitchAccessToken: null,
      driveCode: null,
      sessionExpired: false,
    });
  });

  it("o chat avisa e volta para a lista, sem toast de sucesso", async () => {
    const id = "chat-sumiu";
    await putRaw("chat-giveaways", {
      id,
      title: "Chat ainda aberto",
      description: "desc",
      keyword: "!join",
      cost: 0,
      minimumSuscriptionTimeInMonths: 0,
      subscriberMultiplier: 1,
      subscribersOnly: false,
      winners: [],
      participants: [],
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-01T00:00:00.000Z",
    });
    renderAt(`/dashboard/chat-giveaway/${id}/edit`, <ChatGiveawayEdit />);
    expect(await screen.findByDisplayValue("Chat ainda aberto")).toBeTruthy();

    /* eslint-disable react-hooks/rules-of-hooks */
    await useChatGiveawayDb().softDeleteChatGiveaway(id, DELETED_AT);
    /* eslint-enable react-hooks/rules-of-hooks */

    fireEvent.click(screen.getByRole("button", { name: "Salvar Alterações" }));
    expect(await screen.findByText("Este sorteio foi excluído.")).toBeTruthy();
    await waitFor(() => {
      expect(screen.getByTestId("location").textContent).toBe("/dashboard/chat-giveaway");
    });
    expect(screen.queryByText("Sorteio atualizado")).toBeNull();
    expect(screen.queryByText("Detalhe do chat")).toBeNull();
    expect(await readTitle("chat-giveaways", id)).toBe("Chat ainda aberto");
  });

  it("subscribers avisa e volta para a lista", async () => {
    const id = "sub-sumiu";
    await putRaw("giveaways", {
      id,
      title: "Subs ainda aberto",
      description: "descrição salva",
      subscriptionRequirement: 1000,
      subscriberMultiplier: { "1000": 1, "2000": 2, "3000": 3 },
      participants: [],
      winners: [],
      spreadsheetUrl: null,
    });
    renderAt(`/dashboard/follower-giveaway/${id}/edit`, <EditFollowerGiveawayPage />);
    expect(await screen.findByDisplayValue("Subs ainda aberto")).toBeTruthy();

    /* eslint-disable react-hooks/rules-of-hooks */
    await useSubscriptionGiveawayDb().softDeleteGiveaway(id, DELETED_AT);
    /* eslint-enable react-hooks/rules-of-hooks */

    fireEvent.click(screen.getByRole("button", { name: "Editar Sorteio" }));
    expect(await screen.findByText("Este sorteio foi excluído.")).toBeTruthy();
    await waitFor(() => {
      expect(screen.getByTestId("location").textContent).toBe("/dashboard/follower-giveaway");
    });
    expect(screen.queryByText("Detalhe de subs")).toBeNull();
    expect(await readTitle("giveaways", id)).toBe("Subs ainda aberto");
  });

  it("pontos avisa no lugar do toast de sucesso", async () => {
    const id = "points-sumiu";
    await putRaw("channel-points-giveaways", {
      id,
      title: "Pontos ainda aberto",
      description: "desc",
      cost: 100,
      rewardId: "reward-1",
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
    });
    renderAt(
      `/dashboard/channel-points-giveaway/${id}/edit`,
      <ChannelPointsGiveawayEdit />,
    );
    expect(await screen.findByDisplayValue("Pontos ainda aberto")).toBeTruthy();

    /* eslint-disable react-hooks/rules-of-hooks */
    await useChannelPointsGiveawayDb().softDeleteChannelPointsGiveaway(id, DELETED_AT);
    /* eslint-enable react-hooks/rules-of-hooks */

    fireEvent.click(screen.getByRole("button", { name: "Salvar Alterações" }));
    expect(await screen.findByText("Este sorteio foi excluído.")).toBeTruthy();
    expect(screen.queryByText("Sorteio atualizado")).toBeNull();
    await waitFor(() => {
      expect(screen.getByTestId("location").textContent).toBe(
        "/dashboard/channel-points-giveaway",
      );
    });
    expect(screen.queryByText("Detalhe de pontos")).toBeNull();
    expect(await readTitle("channel-points-giveaways", id)).toBe("Pontos ainda aberto");
  });
});
