import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { WinnersList } from "./winners-list";

function viewport(root: ParentNode = document): HTMLElement {
  const element = root.querySelector('[data-slot="scroll-area-viewport"]');
  if (!(element instanceof HTMLElement)) {
    throw new Error("viewport ausente");
  }
  return element;
}

function distanceToEnd(element: HTMLElement): number {
  return element.scrollHeight - element.scrollTop - element.clientHeight;
}

function items(count: number) {
  return Array.from({ length: count }, (_, index) => (
    <div key={index} data-winner-item style={{ height: "48px" }}>
      Item {index + 1}
    </div>
  ));
}

describe("WinnersList no Chromium", () => {
  it("T1 (CA1/CA2): ordem no DOM, ranks 1..N e pendente por último", () => {
    render(
      <WinnersList
        className="h-[280px]"
        triggerKey="pending-c"
        pendingRank={4}
        pending={<div data-pending-card>Pendente C</div>}
      >
        <div data-winner-item data-rank="1">
          Vencedor A
        </div>
        <div data-winner-item data-rank="2">
          Vencedor B
        </div>
        <div data-winner-item data-rank="3">
          Vencedor C
        </div>
      </WinnersList>
    );

    const rows = [...document.querySelectorAll("[data-winner-item]")];
    expect(rows.map((row) => row.textContent?.trim())).toEqual([
      "Vencedor A",
      "Vencedor B",
      "Vencedor C",
    ]);
    expect(rows.map((row) => row.getAttribute("data-rank"))).toEqual([
      "1",
      "2",
      "3",
    ]);

    const separator = document.querySelector("[data-pending-separator]");
    const pending = document.querySelector("[data-pending-card]");
    expect(separator?.textContent).toContain("#4");
    expect(separator?.textContent).toContain("aguardando confirmação");
    expect(pending).toBeTruthy();
    expect(
      separator!.compareDocumentPosition(pending!) &
        Node.DOCUMENT_POSITION_FOLLOWING
    ).toBeTruthy();
    expect(
      rows[rows.length - 1].compareDocumentPosition(pending!) &
        Node.DOCUMENT_POSITION_FOLLOWING
    ).toBeTruthy();
  });

  it("T2 (CA3): sem overflow, scrollTop permanece 0", async () => {
    const { container, rerender } = render(
      <WinnersList className="h-[280px]" triggerKey={null}>
        <div data-winner-item style={{ height: "40px" }}>
          Item 1
        </div>
      </WinnersList>
    );

    rerender(
      <WinnersList className="h-[280px]" triggerKey="novo">
        <div data-winner-item style={{ height: "40px" }}>
          Item 1
        </div>
        <div data-winner-item style={{ height: "40px" }}>
          Item 2
        </div>
      </WinnersList>
    );

    await expect.poll(() => viewport(container).scrollTop).toBe(0);
    const view = viewport(container);
    expect(view.scrollHeight).toBeLessThanOrEqual(view.clientHeight);
  });

  it("T3 (CA4): cada novo item deixa o fim a no máximo 1px e o último visível", async () => {
    let count = 8;
    const { container, rerender } = render(
      <WinnersList className="h-[280px]" triggerKey="k-8">
        {items(count)}
      </WinnersList>
    );

    await expect
      .poll(() => distanceToEnd(viewport(container)))
      .toBeLessThanOrEqual(1);

    for (count = 9; count <= 12; count += 1) {
      rerender(
        <WinnersList className="h-[280px]" triggerKey={`k-${count}`}>
          {items(count)}
        </WinnersList>
      );

      await expect
        .poll(() => distanceToEnd(viewport(container)))
        .toBeLessThanOrEqual(1);

      const last = screen.getByText(`Item ${count}`);
      const lastRect = last.getBoundingClientRect();
      const viewRect = viewport(container).getBoundingClientRect();
      expect(lastRect.bottom).toBeLessThanOrEqual(viewRect.bottom + 1);
      expect(lastRect.top).toBeGreaterThanOrEqual(viewRect.top);
      expect(lastRect.bottom).toBeGreaterThan(viewRect.top);
    }
  });

  it("T4 (CA5/CA6): rolado para cima, novo sorteado e re-sorteio vão ao fim", async () => {
    const { container, rerender } = render(
      <WinnersList className="h-[280px]" triggerKey="pendente-a">
        {items(10)}
      </WinnersList>
    );

    await expect
      .poll(() => distanceToEnd(viewport(container)))
      .toBeLessThanOrEqual(1);

    viewport(container).scrollTop = 0;
    await expect.poll(() => viewport(container).scrollTop).toBe(0);

    rerender(
      <WinnersList className="h-[280px]" triggerKey="pendente-b">
        {items(10)}
        <div data-pending-card style={{ height: "72px" }}>
          Re-sorteio
        </div>
      </WinnersList>
    );

    await expect
      .poll(() => distanceToEnd(viewport(container)))
      .toBeLessThanOrEqual(1);
    const redraw = screen.getByText("Re-sorteio");
    const redrawRect = redraw.getBoundingClientRect();
    const viewRect = viewport(container).getBoundingClientRect();
    expect(redrawRect.bottom).toBeLessThanOrEqual(viewRect.bottom + 1);
    expect(redrawRect.top).toBeGreaterThanOrEqual(viewRect.top);
  });

  it("T5 (CA7): pendente que cresce depois de montar termina visível", async () => {
    const { container, rerender } = render(
      <WinnersList
        className="h-[280px]"
        triggerKey="pendente"
        pending={
          <div data-pending-card style={{ height: "48px" }}>
            Pendente
          </div>
        }
        pendingRank={11}
      >
        {items(10)}
      </WinnersList>
    );

    await expect
      .poll(() => distanceToEnd(viewport(container)))
      .toBeLessThanOrEqual(1);

    rerender(
      <WinnersList
        className="h-[280px]"
        triggerKey="pendente"
        pending={
          <div data-pending-card style={{ height: "180px" }}>
            Pendente
          </div>
        }
        pendingRank={11}
      >
        {items(10)}
      </WinnersList>
    );

    await expect.poll(() => {
      const pending = container.querySelector("[data-pending-card]");
      if (!pending) return 999;
      const pendingRect = pending.getBoundingClientRect();
      const viewRect = viewport(container).getBoundingClientRect();
      return pendingRect.bottom - viewRect.bottom;
    }).toBeLessThanOrEqual(1);

    const pending = container.querySelector("[data-pending-card]")!;
    const pendingRect = pending.getBoundingClientRect();
    const viewRect = viewport(container).getBoundingClientRect();
    expect(pendingRect.top).toBeGreaterThanOrEqual(viewRect.top);
    expect(pendingRect.height).toBeGreaterThan(100);
  });

  it("T6 (CA8): monta com overflow já no fim", async () => {
    const { container } = render(
      <WinnersList className="h-[280px]" triggerKey={null}>
        {items(12)}
      </WinnersList>
    );

    await expect
      .poll(() => distanceToEnd(viewport(container)))
      .toBeLessThanOrEqual(1);
    const last = screen.getByText("Item 12");
    const lastRect = last.getBoundingClientRect();
    const viewRect = viewport(container).getBoundingClientRect();
    expect(lastRect.bottom).toBeLessThanOrEqual(viewRect.bottom + 1);
    expect(lastRect.top).toBeGreaterThanOrEqual(viewRect.top);
  });

  it("T7 (CA9): confirmar ou remover não leva a lista ao fim", async () => {
    const { container, rerender } = render(
      <WinnersList
        className="h-[280px]"
        triggerKey="pendente"
        pending={
          <div data-pending-card style={{ height: "80px" }}>
            Pendente
          </div>
        }
        pendingRank={11}
      >
        {items(10)}
      </WinnersList>
    );

    await expect
      .poll(() => distanceToEnd(viewport(container)))
      .toBeLessThanOrEqual(1);
    await new Promise((resolve) => setTimeout(resolve, 550));

    viewport(container).scrollTop = 0;
    expect(viewport(container).scrollTop).toBe(0);

    rerender(
      <WinnersList className="h-[280px]" triggerKey={null}>
        {items(10)}
        <div data-winner-item style={{ height: "48px" }}>
          Item 11
        </div>
      </WinnersList>
    );

    await new Promise((resolve) => setTimeout(resolve, 100));
    expect(viewport(container).scrollTop).toBe(0);

    rerender(
      <WinnersList className="h-[280px]" triggerKey={null}>
        {items(8)}
      </WinnersList>
    );

    await new Promise((resolve) => setTimeout(resolve, 100));
    expect(viewport(container).scrollTop).toBe(0);
  });

  it("CA13: montar e rolar não grava storage nem chama persistência", async () => {
    const before = localStorage.length;
    const { container } = render(
      <WinnersList className="h-[280px]" triggerKey={null}>
        {items(12)}
      </WinnersList>
    );
    await expect
      .poll(() => distanceToEnd(viewport(container)))
      .toBeLessThanOrEqual(1);

    viewport(container).scrollTop = 0;
    viewport(container).dispatchEvent(new Event("scroll"));
    await new Promise((resolve) => setTimeout(resolve, 50));

    expect(localStorage.length).toBe(before);
    expect(document.querySelector("[data-pending-separator]")).toBeNull();
  });
});
