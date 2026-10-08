import type { BroadcasterSubscriber } from "@/service/twitch/types";
import { render, screen } from "@testing-library/react";
import i18n from "i18next";
import { I18nextProvider, initReactI18next } from "react-i18next";
import { beforeAll, describe, expect, it, vi } from "vitest";
import { SubscriberWinnersTable } from "./subscriber-winners-table";

const i18nTest = i18n.createInstance();

beforeAll(async () => {
  await i18nTest.use(initReactI18next).init({
    lng: "pt-BR",
    resources: {
      "pt-BR": {
        translation: {
          FOLLOWER_GIVEAWAY_FORM_PARTICIPANTS_TABLE_HEADER: "Participante",
          FOLLOWER_GIVEAWAY_FORM_PARTICIPANTS_SUBSCRIPTION_TIER_TABLE_HEADER:
            "Tier",
          TIER_1000: "Tier 1",
        },
      },
    },
    interpolation: { escapeValue: false },
  });
});

function subscriber(name: string): BroadcasterSubscriber {
  return {
    broadcaster_id: "b1",
    broadcaster_login: "canal",
    broadcaster_name: "Canal",
    gifter_id: "",
    gifter_login: "",
    is_gift: false,
    plan_name: "Tier 1",
    tier: "1000",
    user_id: name,
    user_name: name,
    user_login: name.toLowerCase(),
  };
}

function prependWinners(count: number): BroadcasterSubscriber[] {
  return Array.from({ length: count }, (_, index) =>
    subscriber(`W${count - index}`)
  );
}

function scroller(root: ParentNode = document): HTMLElement {
  const element = root.querySelector("[data-virtuoso-scroller]");
  if (!(element instanceof HTMLElement)) {
    throw new Error("scroller ausente");
  }
  return element;
}

function distanceToEnd(element: HTMLElement): number {
  return element.scrollHeight - element.scrollTop - element.clientHeight;
}

function renderTable(
  winners: BroadcasterSubscriber[],
  onRemove = vi.fn()
) {
  return render(
    <div style={{ width: "640px" }}>
      <I18nextProvider i18n={i18nTest}>
        <SubscriberWinnersTable winners={winners} onRemove={onRemove} />
      </I18nextProvider>
    </div>
  );
}

describe("SubscriberWinnersTable no Chromium", () => {
  it("T8 (CA10): 20 em prepend, ordem invertida e já no fim", async () => {
    const saved = prependWinners(20);
    const snapshot = saved.map((winner) => winner.user_id);

    const { container } = renderTable(saved);

    await expect.poll(() => screen.queryByText("W20")).toBeTruthy();
    await expect
      .poll(() => distanceToEnd(scroller(container)))
      .toBeLessThanOrEqual(2);

    const newest = screen.getByText("W20");
    const newestRect = newest.getBoundingClientRect();
    const viewRect = scroller(container).getBoundingClientRect();
    expect(newestRect.bottom).toBeLessThanOrEqual(viewRect.bottom + 2);
    expect(newestRect.top).toBeGreaterThanOrEqual(viewRect.top);
    expect(saved.map((winner) => winner.user_id)).toEqual(snapshot);

    const ranks = [...container.querySelectorAll("tbody td")]
      .map((cell) => cell.textContent?.trim() ?? "")
      .filter((text) => text.startsWith("#"));
    expect(ranks.at(-1)).toBe("#20");
  });

  it("T8 (CA11): rolado para cima, prepend do novo vencedor aparece na última linha", async () => {
    const saved = prependWinners(20);
    const onRemove = vi.fn();
    const { container, rerender } = renderTable(saved, onRemove);

    await expect
      .poll(() => distanceToEnd(scroller(container)))
      .toBeLessThanOrEqual(2);
    scroller(container).scrollTop = 0;
    await expect.poll(() => scroller(container).scrollTop).toBeLessThan(5);

    const next = [subscriber("W21"), ...saved];
    rerender(
      <div style={{ width: "640px" }}>
        <I18nextProvider i18n={i18nTest}>
          <SubscriberWinnersTable winners={next} onRemove={onRemove} />
        </I18nextProvider>
      </div>
    );

    await expect.poll(() => screen.queryByText("W21")).toBeTruthy();
    await expect.poll(() => {
      const row = screen.getByText("W21").getBoundingClientRect();
      const view = scroller(container).getBoundingClientRect();
      return row.bottom - view.bottom;
    }).toBeLessThanOrEqual(2);

    const row = screen.getByText("W21").getBoundingClientRect();
    const view = scroller(container).getBoundingClientRect();
    expect(row.top).toBeGreaterThanOrEqual(view.top);
    expect(saved[0]?.user_id).toBe("W20");
  });

  it("T8 (CA9): remover vencedor não força scroll", async () => {
    const saved = prependWinners(20);
    const onRemove = vi.fn();
    const { container, rerender } = renderTable(saved, onRemove);

    await expect
      .poll(() => distanceToEnd(scroller(container)))
      .toBeLessThanOrEqual(2);
    scroller(container).scrollTop = 0;
    await expect.poll(() => scroller(container).scrollTop).toBeLessThan(5);
    const before = scroller(container).scrollTop;

    rerender(
      <div style={{ width: "640px" }}>
        <I18nextProvider i18n={i18nTest}>
          <SubscriberWinnersTable
            winners={saved.slice(0, -1)}
            onRemove={onRemove}
          />
        </I18nextProvider>
      </div>
    );

    await new Promise((resolve) => setTimeout(resolve, 500));
    expect(Math.abs(scroller(container).scrollTop - before)).toBeLessThan(5);
    expect(distanceToEnd(scroller(container))).toBeGreaterThan(100);
    expect(onRemove).not.toHaveBeenCalled();
  });

  it("CA13: montar e rolar não chama onRemove nem abre IndexedDB", async () => {
    const onRemove = vi.fn();
    const before = await indexedDB.databases();
    const { container } = renderTable(prependWinners(20), onRemove);

    await expect
      .poll(() => distanceToEnd(scroller(container)))
      .toBeLessThanOrEqual(2);
    scroller(container).scrollTop = 40;
    scroller(container).dispatchEvent(new Event("scroll"));
    await new Promise((resolve) => setTimeout(resolve, 100));

    expect(onRemove).not.toHaveBeenCalled();
    const after = await indexedDB.databases();
    expect(after.map((db) => db.name)).toEqual(before.map((db) => db.name));
  });
});
