import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { WinnersList } from "./winners-list";

describe("WinnersList - Browser Mode (Chromium real)", () => {
  it("T1 (CA1/CA2): ordem cronológica no DOM com ranks 1..N e pendente por último", async () => {
    render(
      <WinnersList
        className="h-[280px]"
        triggerKey="pending-key"
        pendingRank={4}
        pending={
          <div data-winner-item data-pending>
            Pendente #4
          </div>
        }
      >
        <div data-winner-item data-rank="1">
          Vencedor #1
        </div>
        <div data-winner-item data-rank="2">
          Vencedor #2
        </div>
        <div data-winner-item data-rank="3">
          Vencedor #3
        </div>
      </WinnersList>
    );

    const items = document.querySelectorAll("[data-winner-item]");
    expect(items).toHaveLength(4);

    expect(items[0].textContent).toContain("Vencedor #1");
    expect(items[1].textContent).toContain("Vencedor #2");
    expect(items[2].textContent).toContain("Vencedor #3");
    expect(items[3].textContent).toContain("Pendente #4");

    const separator = document.querySelector("[data-pending-separator]");
    expect(separator).toBeTruthy();
    expect(separator?.textContent).toContain("#4");
    expect(separator?.textContent).toContain("aguardando confirmação");
  });

  it("T2 (CA3): sem overflow não rola (scrollTop === 0)", async () => {
    render(
      <WinnersList className="h-[280px]" triggerKey="test">
        <div data-winner-item style={{ height: "50px" }}>
          Item 1
        </div>
        <div data-winner-item style={{ height: "50px" }}>
          Item 2
        </div>
      </WinnersList>
    );

    await new Promise((resolve) => setTimeout(resolve, 100));

    const viewport = document.querySelector(
      '[data-slot="scroll-area-viewport"]'
    ) as HTMLElement;
    expect(viewport).toBeTruthy();
    expect(viewport.scrollTop).toBe(0);
    expect(viewport.scrollHeight).toBeLessThanOrEqual(viewport.clientHeight);
  });

  it("T3 (CA4): com overflow, novo item rola até o fim e último item visível", async () => {
    const { rerender } = render(
      <WinnersList className="h-[280px]" triggerKey="key1">
        {Array.from({ length: 10 }, (_, i) => (
          <div key={i} data-winner-item style={{ height: "60px" }}>
            Item {i + 1}
          </div>
        ))}
      </WinnersList>
    );

    await new Promise((resolve) => setTimeout(resolve, 200));

    const viewport = document.querySelector(
      '[data-slot="scroll-area-viewport"]'
    ) as HTMLElement;
    expect(viewport).toBeTruthy();

    const distanceFromBottom1 =
      viewport.scrollHeight - viewport.scrollTop - viewport.clientHeight;
    expect(distanceFromBottom1).toBeLessThanOrEqual(1);

    const lastItem1 = screen.getByText("Item 10");
    const lastRect1 = lastItem1.getBoundingClientRect();
    const vpRect1 = viewport.getBoundingClientRect();
    expect(lastRect1.bottom).toBeLessThanOrEqual(vpRect1.bottom + 1);
    expect(lastRect1.top).toBeGreaterThanOrEqual(vpRect1.top);

    rerender(
      <WinnersList className="h-[280px]" triggerKey="key2">
        {Array.from({ length: 11 }, (_, i) => (
          <div key={i} data-winner-item style={{ height: "60px" }}>
            Item {i + 1}
          </div>
        ))}
      </WinnersList>
    );

    await new Promise((resolve) => setTimeout(resolve, 200));

    const distanceFromBottom2 =
      viewport.scrollHeight - viewport.scrollTop - viewport.clientHeight;
    expect(distanceFromBottom2).toBeLessThanOrEqual(1);

    const lastItem2 = screen.getByText("Item 11");
    const lastRect2 = lastItem2.getBoundingClientRect();
    const vpRect2 = viewport.getBoundingClientRect();
    expect(lastRect2.bottom).toBeLessThanOrEqual(vpRect2.bottom + 1);
    expect(lastRect2.top).toBeGreaterThanOrEqual(vpRect2.top);
  });

  it("T4 (CA5/CA6): rola do topo até o fim ao receber novo triggerKey (re-sorteio)", async () => {
    const { rerender } = render(
      <WinnersList className="h-[200px]" triggerKey="initial">
        {Array.from({ length: 10 }, (_, i) => (
          <div key={i} data-winner-item style={{ height: "50px" }}>
            Item {i + 1}
          </div>
        ))}
      </WinnersList>
    );

    await new Promise((resolve) => setTimeout(resolve, 100));

    const viewport = document.querySelector(
      '[data-slot="scroll-area-viewport"]'
    ) as HTMLElement;
    expect(viewport).toBeTruthy();

    viewport.scrollTop = 0;
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(viewport.scrollTop).toBe(0);

    rerender(
      <WinnersList className="h-[200px]" triggerKey="new-redraw">
        {Array.from({ length: 11 }, (_, i) => (
          <div key={i} data-winner-item style={{ height: "50px" }}>
            Item {i + 1}
          </div>
        ))}
      </WinnersList>
    );

    await new Promise((resolve) => setTimeout(resolve, 200));

    const distanceFromBottom =
      viewport.scrollHeight - viewport.scrollTop - viewport.clientHeight;
    expect(distanceFromBottom).toBeLessThanOrEqual(1);
  });

  it("T5 (CA7): pendente crescendo de altura termina totalmente visível", async () => {
    const { rerender } = render(
      <WinnersList
        className="h-[200px]"
        triggerKey="pending"
        pending={<div style={{ height: "50px" }}>Pendente</div>}
        pendingRank={11}
      >
        {Array.from({ length: 10 }, (_, i) => (
          <div key={i} data-winner-item style={{ height: "40px" }}>
            Item {i + 1}
          </div>
        ))}
      </WinnersList>
    );

    await new Promise((resolve) => setTimeout(resolve, 100));

    const viewport = document.querySelector(
      '[data-slot="scroll-area-viewport"]'
    ) as HTMLElement;

    rerender(
      <WinnersList
        className="h-[200px]"
        triggerKey="pending"
        pending={<div style={{ height: "150px" }}>Pendente Expandido</div>}
        pendingRank={11}
      >
        {Array.from({ length: 10 }, (_, i) => (
          <div key={i} data-winner-item style={{ height: "40px" }}>
            Item {i + 1}
          </div>
        ))}
      </WinnersList>
    );

    await expect
      .poll(
        () => {
          const pendingEl = screen.getByText("Pendente Expandido");
          const pendingRect = pendingEl.getBoundingClientRect();
          const vpRect = viewport.getBoundingClientRect();
          return pendingRect.bottom <= vpRect.bottom + 2;
        },
        { timeout: 1000, interval: 50 }
      )
      .toBe(true);
  });

  it("T6 (CA8): abre já no fim", async () => {
    render(
      <WinnersList className="h-[200px]" triggerKey="open">
        {Array.from({ length: 15 }, (_, i) => (
          <div key={i} data-winner-item style={{ height: "40px" }}>
            Item {i + 1}
          </div>
        ))}
      </WinnersList>
    );

    await new Promise((resolve) => setTimeout(resolve, 200));

    const viewport = document.querySelector(
      '[data-slot="scroll-area-viewport"]'
    ) as HTMLElement;
    const distanceFromBottom =
      viewport.scrollHeight - viewport.scrollTop - viewport.clientHeight;
    expect(distanceFromBottom).toBeLessThanOrEqual(2);
  });

  it("T7 (CA9): triggerKey null (confirmar) não rola", async () => {
    const { rerender } = render(
      <WinnersList className="h-[200px]" triggerKey="pending">
        {Array.from({ length: 10 }, (_, i) => (
          <div key={i} data-winner-item style={{ height: "50px" }}>
            Item {i + 1}
          </div>
        ))}
      </WinnersList>
    );

    await new Promise((resolve) => setTimeout(resolve, 100));

    const viewport = document.querySelector(
      '[data-slot="scroll-area-viewport"]'
    ) as HTMLElement;

    viewport.scrollTop = 0;
    await new Promise((resolve) => setTimeout(resolve, 50));
    const initialScrollTop = viewport.scrollTop;

    rerender(
      <WinnersList className="h-[200px]" triggerKey={null}>
        {Array.from({ length: 10 }, (_, i) => (
          <div key={i} data-winner-item style={{ height: "50px" }}>
            Item {i + 1}
          </div>
        ))}
      </WinnersList>
    );

    await new Promise((resolve) => setTimeout(resolve, 200));

    expect(viewport.scrollTop).toBe(initialScrollTop);
  });
});
