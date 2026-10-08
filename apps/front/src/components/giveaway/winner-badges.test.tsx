import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import "@/i18n";
import { DATABASE_VERSION, openDb } from "@/database";
import { localDateTimeToIso } from "@/lib/winner-badges/datetime";
import {
  noteGiveawayConfirmed,
  resetWinnerIndexSession,
  startWinnerIndex,
  useWinnerIndexStore,
} from "@/lib/winner-badges/readiness";
import type { EngineClock, WinEvent } from "@/lib/winner-badges/types";
import { STORAGE_KEY_STREAM_DROPS_SETTINGS } from "@/storage";
import { useSettingsStore } from "@/storage/settings";
import { PendingWinnerCard } from "./pending-winner-card";
import { WinnerBadgeSurface } from "./winner-badge-surface";
import { WinnerLogRow } from "./winner-log-row";
import { WinnerMoment } from "./winner-moment";

const ZONE = "America/Sao_Paulo";

function at(
  year: number,
  month: number,
  day: number,
  hour = 12,
  minute = 0,
  second = 0,
): string {
  const iso = localDateTimeToIso(
    { year, month, day, hour, minute, second, millisecond: 0 },
    ZONE,
  );
  if (!iso) throw new Error("fuso inválido");
  return iso;
}

function clock(now: string): EngineClock {
  return { now, timeZone: ZONE };
}

function chatWin(
  giveawayId: string,
  drawnAt: string,
  context?: { subscriptionMonths: number; tier: 1000 | 2000 | 3000 },
) {
  return {
    id: giveawayId,
    winners: [
      {
        id: `${giveawayId}-w`,
        twitchId: "u",
        name: "Ana",
        avatar: "",
        drawnAt,
        ...(context ? { context } : {}),
      },
    ],
  };
}

function pendingEvent(giveawayId: string): WinEvent {
  return {
    userKey: "twitch:u",
    platform: "twitch",
    userId: "u",
    giveawayType: "chat",
    giveawayId,
    index: 0,
    name: "Ana",
    preview: true,
  };
}

function confirmedEvent(giveawayId: string, wonAt: string): WinEvent {
  return {
    ...pendingEvent(giveawayId),
    wonAt,
    preview: false,
  };
}

async function snapshotDatabase(): Promise<string> {
  const db = await openDb();
  const names = [...db.objectStoreNames];
  const rows = await new Promise<unknown[][]>((resolve, reject) => {
    const tx = db.transaction(names, "readonly");
    const collected: unknown[][] = names.map(() => []);
    names.forEach((name, index) => {
      const request = tx.objectStore(name).getAll();
      request.onsuccess = () => {
        collected[index] = request.result as unknown[];
      };
    });
    tx.oncomplete = () => resolve(collected);
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error);
  });
  return JSON.stringify({
    name: db.name,
    version: db.version,
    names,
    rows,
  });
}

function winsSnapshot(): string {
  return JSON.stringify(useWinnerIndexStore.getState().index?.getWins() ?? []);
}

describe("selos no card e no log", () => {
  beforeEach(() => {
    resetWinnerIndexSession();
    localStorage.removeItem(STORAGE_KEY_STREAM_DROPS_SETTINGS);
    useSettingsStore.setState({ badges: { enabled: true } });
    localStorage.removeItem(STORAGE_KEY_STREAM_DROPS_SETTINGS);
  });

  afterEach(() => {
    cleanup();
    resetWinnerIndexSession();
    localStorage.removeItem(STORAGE_KEY_STREAM_DROPS_SETTINGS);
    useSettingsStore.setState({ badges: { enabled: true } });
    localStorage.removeItem(STORAGE_KEY_STREAM_DROPS_SETTINGS);
  });

  it("CA2: cancelar a prévia não muda o histórico e a prévia some", async () => {
    const previous = at(2026, 10, 6, 23);
    startWinnerIndex({
      read: async () => ({ chat: [chatWin("confirmada", previous)] }),
    });
    await waitFor(() => {
      expect(useWinnerIndexStore.getState().status).toBe("ready");
    });
    const before = winsSnapshot();

    const view = render(
      <PendingWinnerCard
        name="Ana"
        hint="aguardando"
        win={pendingEvent("pendente")}
        clock={clock(at(2026, 10, 7, 23, 59, 50))}
      />,
    );

    expect(await screen.findByText("2 dias")).toBeTruthy();
    expect(document.querySelector("[data-badge-preview]")?.textContent).toBe(
      "prévia",
    );
    expect(winsSnapshot()).toBe(before);

    view.unmount();
    expect(document.querySelector("[data-badge-preview]")).toBeNull();
    expect(document.querySelector("[data-winner-badge]")).toBeNull();
    expect(winsSnapshot()).toBe(before);
  });

  it("CA3: a prévia usa o agora e o log usa o drawnAt da confirmação", async () => {
    const previous = at(2026, 10, 6, 22);
    const previewNow = at(2026, 10, 7, 23, 59, 50);
    const confirmedAt = at(2026, 10, 8, 0, 0, 10);
    startWinnerIndex({
      read: async () => ({ chat: [chatWin("dia-6", previous)] }),
    });

    const { rerender } = render(
      <PendingWinnerCard
        name="Ana"
        hint="aguardando"
        win={pendingEvent("pendente")}
        clock={clock(previewNow)}
      />,
    );

    expect(await screen.findByText("2 dias")).toBeTruthy();
    expect(
      document.querySelector("[data-winner-badge='streak_daily']"),
    ).toBeTruthy();

    const confirmedRecord = chatWin("pendente", confirmedAt);
    noteGiveawayConfirmed("chat", confirmedRecord);
    rerender(
      <WinnerLogRow
        rank={2}
        name="Ana"
        avatar=""
        drawnAt={confirmedAt}
        badgeWin={confirmedEvent("pendente", confirmedAt)}
      />,
    );

    await waitFor(() => {
      expect(screen.getByText("Ana")).toBeTruthy();
    });
    expect(document.querySelector("[data-badge-preview]")).toBeNull();
    expect(
      document.querySelector("[data-winner-log-badge='streak_daily']"),
    ).toBeNull();
    expect(screen.queryByText("2 dias")).toBeNull();
  });

  it("CA17: card mostra 3 + 2, log mostra 2 e o tooltip lista os 5", async () => {
    const records = [3, 4, 5, 6].map((day) =>
      chatWin(`dia-${day}`, at(2026, 10, day, 12)),
    );
    records.push(
      chatWin("t10", at(2026, 10, 7, 10)),
      chatWin("t11", at(2026, 10, 7, 11)),
      chatWin("t12", at(2026, 10, 7, 12), {
        subscriptionMonths: 24,
        tier: 3000,
      }),
    );
    startWinnerIndex({ read: async () => ({ chat: records }) });
    const target = confirmedEvent("t12", at(2026, 10, 7, 12));
    target.context = { subscriptionMonths: 24, tier: "3000" };
    const when = clock(target.wonAt ?? "");

    render(
      <div>
        <WinnerBadgeSurface
          surface="reveal"
          win={target}
          clock={when}
        />
        <WinnerLogRow
          rank={7}
          name="Ana"
          avatar=""
          drawnAt={target.wonAt ?? ""}
          badgeWin={target}
        />
      </div>,
    );

    expect(await screen.findByText("+2")).toBeTruthy();
    const card = document.querySelector("[data-winner-badges='reveal']");
    expect(
      [...(card?.querySelectorAll("[data-winner-badge]") ?? [])].map((node) =>
        node.getAttribute("data-winner-badge"),
      ),
    ).toEqual(["streak_daily", "hat_trick_24h", "loyal_sub"]);
    expect(card?.querySelector("[data-badge-overflow]")?.textContent).toBe("+2");

    const log = document.querySelector("[data-winner-badges='log']");
    expect(
      [...(log?.querySelectorAll("[data-winner-log-badge]") ?? [])].map((node) =>
        node.getAttribute("data-winner-log-badge"),
      ),
    ).toEqual(["streak_daily", "hat_trick_24h"]);

    fireEvent.focus(card as HTMLElement);
    await waitFor(() => {
      const items = [
        ...document.querySelectorAll("[data-badge-tooltip-item]"),
      ].map((node) => node.getAttribute("data-badge-tooltip-item"));
      expect(items).toEqual([
        "streak_daily",
        "hat_trick_24h",
        "loyal_sub",
        "month_regular",
        "month_lead",
      ]);
    });
  });

  it("CA23: com o toggle desligado os selos somem do card, da revelação e do log", async () => {
    startWinnerIndex({
      read: async () => ({ chat: [] }),
    });
    const win = pendingEvent("novo");
    const when = clock(at(2026, 10, 7, 15));
    useSettingsStore.setState({ badges: { enabled: false } });

    const view = render(
      <div>
        <PendingWinnerCard name="Ana" hint="aguardando" win={win} clock={when} />
        <WinnerMoment
          pendingWinner={{
            id: "u",
            displayName: "Ana",
            avatar: "",
            subscriber: false,
          }}
          messages={[]}
          giveawayTitle="Sorteio"
          onConfirm={() => undefined}
          onDismiss={() => undefined}
          onCancel={() => undefined}
          onRedraw={() => undefined}
          isRedrawing={false}
          badges={
            <WinnerBadgeSurface surface="reveal" preview win={win} clock={when} />
          }
        />
        <WinnerLogRow
          rank={1}
          name="Ana"
          avatar=""
          drawnAt={when.now}
          badgeWin={{ ...win, preview: false, wonAt: when.now }}
        />
      </div>,
    );

    expect(screen.getByText("Ana")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Confirmar" })).toBeTruthy();
    expect(document.querySelector("[data-winner-badges]")).toBeNull();
    expect(document.querySelector("[data-winner-badge]")).toBeNull();
    expect(document.querySelector("[data-badge-slot]")).toBeNull();
    expect(document.querySelector("[data-badge-preview]")).toBeNull();
    expect(document.querySelector("[data-badge-highlight]")).toBeNull();

    useSettingsStore.setState({ badges: { enabled: true } });
    view.rerender(
      <div>
        <PendingWinnerCard name="Ana" hint="aguardando" win={win} clock={when} />
        <WinnerLogRow
          rank={1}
          name="Ana"
          avatar=""
          drawnAt={when.now}
          badgeWin={{ ...win, preview: false, wonAt: when.now }}
        />
      </div>,
    );
    expect(await screen.findByText("1º Drop")).toBeTruthy();
  });

  it("CA25: o card aparece na hora e os selos entram quando o índice fica pronto", async () => {
    const draw = vi.fn();
    startWinnerIndex({
      delayMs: 400,
      read: async () => ({ chat: [] }),
    });
    const win = pendingEvent("novo");
    const when = clock(at(2026, 10, 7, 15));

    render(
      <div>
        <button type="button" onClick={draw}>
          Sortear
        </button>
        <PendingWinnerCard name="Ana" hint="aguardando" win={win} clock={when} />
        <WinnerMoment
          pendingWinner={{
            id: "u",
            displayName: "Ana",
            avatar: "",
            subscriber: false,
          }}
          messages={[]}
          giveawayTitle="Sorteio"
          onConfirm={() => undefined}
          onDismiss={() => undefined}
          onCancel={() => undefined}
          onRedraw={() => undefined}
          isRedrawing={false}
          badges={
            <WinnerBadgeSurface surface="reveal" preview win={win} clock={when} />
          }
        />
      </div>,
    );

    expect(screen.getAllByText("Ana").length).toBeGreaterThan(0);
    expect(document.querySelector("[data-pending-card]")).toBeTruthy();
    expect(document.querySelector("[data-winner-badge]")).toBeNull();
    expect(document.querySelectorAll("[data-badge-slot='loading']").length).toBe(
      2,
    );
    const drawButton = screen.getByRole("button", { name: "Sortear" });
    const confirm = screen.getByRole("button", { name: "Confirmar" });
    expect((drawButton as HTMLButtonElement).disabled).toBe(false);
    expect((confirm as HTMLButtonElement).disabled).toBe(false);
    fireEvent.click(drawButton);
    expect(draw).toHaveBeenCalledOnce();

    expect(await screen.findAllByText("1º Drop")).toHaveLength(2);
    expect(document.querySelector("[data-badge-slot='loading']")).toBeNull();
    expect((confirm as HTMLButtonElement).disabled).toBe(false);
  });

  it("abrir card, revelação e log não grava sorteio nem a chave de selos", async () => {
    const stored = JSON.stringify({
      state: { badges: { enabled: true } },
      version: 1,
    });
    localStorage.setItem(STORAGE_KEY_STREAM_DROPS_SETTINGS, stored);
    await useSettingsStore.persist.rehydrate();
    const beforeSettings = localStorage.getItem(STORAGE_KEY_STREAM_DROPS_SETTINGS);
    const beforeDb = await snapshotDatabase();
    const writes: string[] = [];
    const proto = IDBObjectStore.prototype;
    const originalPut = proto.put;
    const originalAdd = proto.add;
    const originalDelete = proto.delete;
    proto.put = function (...args: Parameters<IDBObjectStore["put"]>) {
      writes.push(`put:${this.name}`);
      return originalPut.apply(this, args);
    };
    proto.add = function (...args: Parameters<IDBObjectStore["add"]>) {
      writes.push(`add:${this.name}`);
      return originalAdd.apply(this, args);
    };
    proto.delete = function (...args: Parameters<IDBObjectStore["delete"]>) {
      writes.push(`delete:${this.name}`);
      return originalDelete.apply(this, args);
    };

    try {
      startWinnerIndex({
        read: async () => ({ chat: [chatWin("g", at(2026, 10, 7, 12))] }),
      });
      const win = confirmedEvent("g", at(2026, 10, 7, 12));
      render(
        <div>
          <PendingWinnerCard
            name="Novo"
            hint="aguardando"
            win={pendingEvent("pendente")}
            clock={clock(at(2026, 10, 7, 18))}
          />
          <WinnerBadgeSurface surface="reveal" win={win} clock={clock(win.wonAt ?? "")} />
          <WinnerLogRow
            rank={1}
            name="Ana"
            avatar=""
            drawnAt={win.wonAt ?? ""}
            badgeWin={win}
          />
        </div>,
      );
      expect(await screen.findByText("1º Drop")).toBeTruthy();
      expect(writes).toEqual([]);
      expect(localStorage.getItem(STORAGE_KEY_STREAM_DROPS_SETTINGS)).toBe(
        beforeSettings,
      );
      expect(await snapshotDatabase()).toBe(beforeDb);
      expect(DATABASE_VERSION).toBe(12);
      expect(beforeSettings).toBe(stored);
    } finally {
      proto.put = originalPut;
      proto.add = originalAdd;
      proto.delete = originalDelete;
    }
  });
});
