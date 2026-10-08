import { describe, it, expect, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { WinnersList } from "./winners-list";

describe("WinnersList - Auto-scroll", () => {
  beforeEach(() => {
    document.body.innerHTML = "";
  });

  it("T2: sem overflow não rola (scrollTop === 0)", async () => {
    const { container } = render(
      <WinnersList className="h-[280px]" triggerKey="test">
        <div data-winner-item style={{ height: "50px" }}>
          Item 1
        </div>
        <div data-winner-item style={{ height: "50px" }}>
          Item 2
        </div>
      </WinnersList>
    );

    await waitFor(() => {
      const viewport = container.querySelector(
        '[data-slot="scroll-area-viewport"]'
      ) as HTMLElement;
      expect(viewport).toBeTruthy();
      expect(viewport.scrollTop).toBe(0);
    });
  });

  it("T3: com overflow, novo item rola até o fim", async () => {
    const { container, rerender } = render(
      <WinnersList className="h-[280px]" triggerKey="key1">
        {Array.from({ length: 10 }, (_, i) => (
          <div key={i} data-winner-item style={{ height: "60px" }}>
            Item {i + 1}
          </div>
        ))}
      </WinnersList>
    );

    await waitFor(() => {
      const viewport = container.querySelector(
        '[data-slot="scroll-area-viewport"]'
      ) as HTMLElement;
      expect(viewport).toBeTruthy();

      const distanceFromBottom =
        viewport.scrollHeight - viewport.scrollTop - viewport.clientHeight;
      expect(distanceFromBottom).toBeLessThanOrEqual(1);
    });

    rerender(
      <WinnersList className="h-[280px]" triggerKey="key2">
        {Array.from({ length: 11 }, (_, i) => (
          <div key={i} data-winner-item style={{ height: "60px" }}>
            Item {i + 1}
          </div>
        ))}
      </WinnersList>
    );

    await waitFor(() => {
      const viewport = container.querySelector(
        '[data-slot="scroll-area-viewport"]'
      ) as HTMLElement;

      const distanceFromBottom =
        viewport.scrollHeight - viewport.scrollTop - viewport.clientHeight;
      expect(distanceFromBottom).toBeLessThanOrEqual(1);
    });
  });

  it("T4: rola do topo até o fim ao receber novo triggerKey", async () => {
    const { container, rerender } = render(
      <WinnersList className="h-[200px]" triggerKey="initial">
        {Array.from({ length: 10 }, (_, i) => (
          <div key={i} data-winner-item style={{ height: "50px" }}>
            Item {i + 1}
          </div>
        ))}
      </WinnersList>
    );

    await waitFor(() => {
      const viewport = container.querySelector(
        '[data-slot="scroll-area-viewport"]'
      ) as HTMLElement;
      expect(viewport).toBeTruthy();
    });

    const viewport = container.querySelector(
      '[data-slot="scroll-area-viewport"]'
    ) as HTMLElement;

    viewport.scrollTop = 0;

    rerender(
      <WinnersList className="h-[200px]" triggerKey="new">
        {Array.from({ length: 11 }, (_, i) => (
          <div key={i} data-winner-item style={{ height: "50px" }}>
            Item {i + 1}
          </div>
        ))}
      </WinnersList>
    );

    await waitFor(() => {
      const distanceFromBottom =
        viewport.scrollHeight - viewport.scrollTop - viewport.clientHeight;
      expect(distanceFromBottom).toBeLessThanOrEqual(1);
    });
  });

  it("T6: abre já no fim (CA8)", async () => {
    const { container } = render(
      <WinnersList className="h-[200px]" triggerKey="open">
        {Array.from({ length: 15 }, (_, i) => (
          <div key={i} data-winner-item style={{ height: "40px" }}>
            Item {i + 1}
          </div>
        ))}
      </WinnersList>
    );

    await waitFor(() => {
      const viewport = container.querySelector(
        '[data-slot="scroll-area-viewport"]'
      ) as HTMLElement;
      const distanceFromBottom =
        viewport.scrollHeight - viewport.scrollTop - viewport.clientHeight;
      expect(distanceFromBottom).toBeLessThanOrEqual(2);
    });
  });

  it("T7: triggerKey null (confirmar) não rola", async () => {
    const { container, rerender } = render(
      <WinnersList className="h-[200px]" triggerKey="pending">
        {Array.from({ length: 10 }, (_, i) => (
          <div key={i} data-winner-item style={{ height: "50px" }}>
            Item {i + 1}
          </div>
        ))}
      </WinnersList>
    );

    await waitFor(() => {
      const viewport = container.querySelector(
        '[data-slot="scroll-area-viewport"]'
      ) as HTMLElement;
      expect(viewport).toBeTruthy();
    });

    const viewport = container.querySelector(
      '[data-slot="scroll-area-viewport"]'
    ) as HTMLElement;

    viewport.scrollTop = 0;
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

    await new Promise((resolve) => setTimeout(resolve, 100));

    expect(viewport.scrollTop).toBe(initialScrollTop);
  });
});
