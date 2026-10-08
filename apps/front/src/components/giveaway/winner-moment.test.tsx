import type { ComponentProps } from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { cdp } from "vitest/browser";
import "@/i18n";
import { WinnerMoment } from "./winner-moment";
import type { PendingWinnerInfo } from "./types";

const confetti = vi.hoisted(() => vi.fn());

vi.mock("canvas-confetti", () => ({
  default: confetti,
}));

const winner: PendingWinnerInfo = {
  id: "flavia",
  displayName: "FlaviaQueen",
  avatar: "",
  subscriber: true,
  tier: 2000,
  subscriptionMonths: 19,
};

function renderMoment(
  overrides: Partial<ComponentProps<typeof WinnerMoment>> = {},
) {
  const onConfirm = vi.fn(async () => undefined);
  const onDismiss = vi.fn();
  const onCancel = vi.fn();
  const onRedraw = vi.fn();
  render(
    <WinnerMoment
      pendingWinner={winner}
      messages={[]}
      rank={7}
      giveawayTitle="Sorteio do Chat — Live"
      onConfirm={onConfirm}
      onDismiss={onDismiss}
      onCancel={onCancel}
      onRedraw={onRedraw}
      isRedrawing={false}
      {...overrides}
    />,
  );
  return { onConfirm, onDismiss, onCancel, onRedraw };
}

describe("WinnerMoment", () => {
  afterEach(async () => {
    confetti.mockClear();
    const client = cdp();
    await client.send("Emulation.setEmulatedMedia", { features: [] });
  });

  it("mostra o nome grande, o lugar na ordem e as ações", () => {
    renderMoment();
    expect(screen.getByRole("dialog", { name: "FlaviaQueen" })).toBeTruthy();
    expect(screen.getByText(/Vencedor nº 7/)).toBeTruthy();
    expect(screen.getByText(/sub há 19 meses/)).toBeTruthy();
    expect(screen.getByText("Tier 2")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Cancelar" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Refazer" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Confirmar" })).toBeTruthy();
    expect(
      screen.getByText("Salvo neste navegador ao confirmar"),
    ).toBeTruthy();
  });

  it("confirmar desabilita o botão e chama onConfirm", async () => {
    const { onConfirm } = renderMoment();
    const button = screen.getByRole("button", {
      name: "Confirmar",
    }) as HTMLButtonElement;
    fireEvent.click(button);
    expect(button.disabled).toBe(true);
    expect(onConfirm).toHaveBeenCalledOnce();
  });

  it("celebra com confete quando o movimento é permitido", async () => {
    renderMoment();
    await new Promise((resolve) => setTimeout(resolve, 30));
    expect(confetti).toHaveBeenCalled();
    const beam = document.querySelector("[data-winner-beam]");
    expect(beam).toBeTruthy();
    expect(getComputedStyle(beam!).animationName).toBe("sd-winner-beam");
  });

  it("Esc não confirma, não descarta e não esconde o palco", () => {
    const { onConfirm, onDismiss, onCancel, onRedraw } = renderMoment();
    const dialog = screen.getByRole("dialog", { name: "FlaviaQueen" });
    fireEvent.keyDown(dialog, { key: "Escape" });
    expect(onConfirm).not.toHaveBeenCalled();
    expect(onDismiss).not.toHaveBeenCalled();
    expect(onCancel).not.toHaveBeenCalled();
    expect(onRedraw).not.toHaveBeenCalled();
    expect(screen.getByRole("dialog", { name: "FlaviaQueen" })).toBeTruthy();
  });

  it("no modo de revelação, Esc não fecha e não há confirmar", () => {
    const onClose = vi.fn();
    renderMoment({
      reveal: {
        eyebrow: "Resultado da roleta",
        subtitle: "Roleta de Prêmios da Live",
        closeLabel: "Continuar",
        onClose,
      },
    });
    expect(screen.getByText("Resultado da roleta")).toBeTruthy();
    expect(screen.getByText("Roleta de Prêmios da Live")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Continuar" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Confirmar" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Cancelar" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Refazer" })).toBeNull();
    expect(screen.queryByText("Salvo neste navegador ao confirmar")).toBeNull();

    const dialog = screen.getByRole("dialog", { name: "FlaviaQueen" });
    fireEvent.keyDown(dialog, { key: "Escape" });
    expect(onClose).not.toHaveBeenCalled();
    expect(screen.getByRole("dialog", { name: "FlaviaQueen" })).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Continuar" }));
    expect(onClose).toHaveBeenCalledOnce();
  });

  it("respeita prefers-reduced-motion: sem confete e sem animação", async () => {
    const client = cdp();
    await client.send("Emulation.setEmulatedMedia", {
      features: [{ name: "prefers-reduced-motion", value: "reduce" }],
    });
    renderMoment();
    await new Promise((resolve) => setTimeout(resolve, 40));
    expect(confetti).not.toHaveBeenCalled();
    const stage = document.querySelector("[data-winner-moment]");
    expect(stage?.getAttribute("data-motion")).toBe("reduced");
    const beam = document.querySelector("[data-winner-beam]");
    expect(getComputedStyle(beam!).animationName).toBe("none");
    const name = document.querySelector(".sd-winner-name");
    expect(getComputedStyle(name!).animationName).toBe("none");
  });
});
