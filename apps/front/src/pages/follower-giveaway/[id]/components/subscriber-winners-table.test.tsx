import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { SubscriberWinnersTable } from "./subscriber-winners-table";
import type { BroadcasterSubscriber } from "@/service/twitch/types";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

const createWinners = (count: number): BroadcasterSubscriber[] =>
  Array.from({ length: count }, (_, i) => ({
    user_id: String(count - i),
    user_name: `User${count - i}`,
    user_login: `user${count - i}`,
    tier: "1000",
    broadcaster_id: "broadcaster123",
    broadcaster_login: "broadcaster",
    broadcaster_name: "Broadcaster",
    gifter_id: "",
    gifter_login: "",
    is_gift: false,
    plan_name: "Tier 1",
  }));

describe("SubscriberWinnersTable - Browser Mode (T8 completo)", () => {
  it("T8-A (CA10): 20 vencedores em prepend, exibição invertida e já no fim", async () => {
    const winners = createWinners(20);

    render(<SubscriberWinnersTable winners={winners} onRemove={vi.fn()} />);

    await new Promise((resolve) => setTimeout(resolve, 300));

    expect(screen.getByText("User1")).toBeInTheDocument();
    expect(screen.getByText("User20")).toBeInTheDocument();

    const rows = document.querySelectorAll("tbody tr");
    expect(rows.length).toBeGreaterThan(0);

    const scroller = document.querySelector(
      '[data-testid="virtuoso-scroller"]'
    ) as HTMLElement;
    expect(scroller).toBeTruthy();

    const distanceFromBottom =
      scroller.scrollHeight - scroller.scrollTop - scroller.clientHeight;
    expect(distanceFromBottom).toBeLessThanOrEqual(50);
  });

  it("T8-B (CA10): não muta o array original", () => {
    const winners = createWinners(3);
    const original = [...winners];

    render(<SubscriberWinnersTable winners={winners} onRemove={vi.fn()} />);

    expect(winners).toEqual(original);
  });

  it("T8-C (CA11): rolar para cima e adicionar no início do array faz o novo aparecer na última linha visível", async () => {
    const { rerender } = render(
      <SubscriberWinnersTable winners={createWinners(12)} onRemove={vi.fn()} />
    );

    await new Promise((resolve) => setTimeout(resolve, 300));

    const scroller = document.querySelector(
      '[data-testid="virtuoso-scroller"]'
    ) as HTMLElement;
    expect(scroller).toBeTruthy();

    scroller.scrollTop = 0;
    await new Promise((resolve) => setTimeout(resolve, 100));

    const newWinner: BroadcasterSubscriber = {
      user_id: "13",
      user_name: "User13",
      user_login: "user13",
      tier: "1000",
      broadcaster_id: "broadcaster123",
      broadcaster_login: "broadcaster",
      broadcaster_name: "Broadcaster",
      gifter_id: "",
      gifter_login: "",
      is_gift: false,
      plan_name: "Tier 1",
    };

    rerender(
      <SubscriberWinnersTable
        winners={[newWinner, ...createWinners(12)]}
        onRemove={vi.fn()}
      />
    );

    await expect
      .poll(
        () => {
          const newUserEl = screen.queryByText("User13");
          if (!newUserEl) return false;

          const newUserRect = newUserEl.getBoundingClientRect();
          const scrollerRect = scroller.getBoundingClientRect();

          return (
            newUserRect.bottom <= scrollerRect.bottom + 50 &&
            newUserRect.top >= scrollerRect.top
          );
        },
        { timeout: 1000, interval: 50 }
      )
      .toBe(true);
  });

  it("T8-D (CA9): remover vencedor não força scroll", async () => {
    const { rerender } = render(
      <SubscriberWinnersTable winners={createWinners(12)} onRemove={vi.fn()} />
    );

    await new Promise((resolve) => setTimeout(resolve, 300));

    const scroller = document.querySelector(
      '[data-testid="virtuoso-scroller"]'
    ) as HTMLElement;
    expect(scroller).toBeTruthy();

    scroller.scrollTop = 0;
    await new Promise((resolve) => setTimeout(resolve, 100));
    const initialScrollTop = scroller.scrollTop;

    rerender(
      <SubscriberWinnersTable
        winners={createWinners(12).slice(1)}
        onRemove={vi.fn()}
      />
    );

    await new Promise((resolve) => setTimeout(resolve, 200));

    expect(Math.abs(scroller.scrollTop - initialScrollTop)).toBeLessThan(5);
  });

  it("T8-E (CA13 isolado): componente não recebe callbacks de persistência", () => {
    const onRemove = vi.fn();

    render(<SubscriberWinnersTable winners={createWinners(3)} onRemove={onRemove} />);

    expect(onRemove).not.toHaveBeenCalled();
  });
});
