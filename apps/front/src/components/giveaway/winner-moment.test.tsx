import type { ComponentProps } from "react";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { cdp } from "vitest/browser";
import "@/i18n";
import { WinnerMoment } from "./winner-moment";
import { nameAt } from "./winner-reveal";
import type { PendingWinnerInfo } from "./types";

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
    const pieces = document.querySelectorAll("[data-winner-confetti]");
    expect(pieces.length).toBeGreaterThan(0);
    expect(pieces.length).toBeLessThanOrEqual(56);
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

  it("no modo só de resultado, Esc não fecha e Continuar confirma", () => {
    const { onConfirm, onDismiss, onCancel, onRedraw } = renderMoment({
      showCancel: false,
      showRedraw: false,
      showChatWait: false,
      confirmLabel: "Continuar",
      localHint: "Neste navegador",
      eyebrow: "Resultado da roleta",
      subtitle: "Roleta de Prêmios da Live",
    });
    expect(screen.getByText("Resultado da roleta")).toBeTruthy();
    expect(screen.getByText("Roleta de Prêmios da Live")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Continuar" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Confirmar" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Cancelar" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Refazer" })).toBeNull();
    expect(screen.queryByText(/Aguardando/)).toBeNull();
    expect(screen.queryByText("Salvo neste navegador ao confirmar")).toBeNull();
    expect(screen.getByText("Neste navegador")).toBeTruthy();

    const dialog = screen.getByRole("dialog", { name: "FlaviaQueen" });
    fireEvent.keyDown(dialog, { key: "Escape" });
    expect(onConfirm).not.toHaveBeenCalled();
    expect(onDismiss).not.toHaveBeenCalled();
    expect(onCancel).not.toHaveBeenCalled();
    expect(onRedraw).not.toHaveBeenCalled();
    expect(screen.getByRole("dialog", { name: "FlaviaQueen" })).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Continuar" }));
    expect(onConfirm).toHaveBeenCalledOnce();
  });

  it("respeita prefers-reduced-motion: sem confete e sem animação", async () => {
    const client = cdp();
    await client.send("Emulation.setEmulatedMedia", {
      features: [{ name: "prefers-reduced-motion", value: "reduce" }],
    });
    renderMoment();
    await new Promise((resolve) => setTimeout(resolve, 40));
    expect(document.querySelectorAll("[data-winner-confetti]")).toHaveLength(0);
    const stage = document.querySelector("[data-winner-moment]");
    expect(stage?.getAttribute("data-motion")).toBe("reduced");
    const beam = document.querySelector("[data-winner-beam]");
    expect(getComputedStyle(beam!).animationName).toBe("none");
    const name = document.querySelector(".sd-winner-name");
    expect(getComputedStyle(name!).animationName).toBe("none");
  });

  it("esconde o nome até a tampa estourar", () => {
    expect(nameAt("common")).toBe(500);
    expect(nameAt("rare")).toBe(610);
    expect(nameAt("epic")).toBe(610);
    expect(nameAt("legendary")).toBe(720);

    const seek = (ms: number) => {
      const name = document.querySelector(".sd-winner-name");
      expect(name).toBeTruthy();
      const animations = name!.getAnimations();
      expect(animations.length).toBeGreaterThan(0);
      for (const animation of animations) {
        animation.pause();
        animation.currentTime = ms;
      }
      return Number(getComputedStyle(name!).opacity);
    };

    renderMoment({
      pendingWinner: { ...winner, tier: 3000, displayName: "Mari_Plays" },
    });
    expect(seek(700)).toBeLessThan(0.05);
    expect(seek(960)).toBeGreaterThan(0.95);
    expect(
      document.querySelectorAll("[data-winner-confetti]").length,
    ).toBeLessThanOrEqual(56);
    expect(document.querySelectorAll("[data-winner-confetti]")).toHaveLength(56);

    cleanup();
    renderMoment({
      pendingWinner: {
        ...winner,
        tier: undefined,
        subscriber: false,
        displayName: "Mari_Plays",
      },
    });
    expect(seek(400)).toBeLessThan(0.05);
    expect(seek(800)).toBeGreaterThan(0.95);
  });

  it("no movimento reduzido o palco já nasce assentado, sem confete", async () => {
    const client = cdp();
    await client.send("Emulation.setEmulatedMedia", {
      features: [{ name: "prefers-reduced-motion", value: "reduce" }],
    });
    renderMoment({
      pendingWinner: { ...winner, tier: 3000, displayName: "Mari_Plays" },
    });
    await new Promise((resolve) => setTimeout(resolve, 40));
    expect(document.querySelectorAll("[data-winner-confetti]")).toHaveLength(0);
    expect(document.querySelector("[data-reveal='rays']")).toBeNull();
    const stage = document.querySelector("[data-winner-moment]");
    expect(stage?.getAttribute("data-motion")).toBe("reduced");
    const slot = document.querySelector("[data-winner-slot]") as HTMLElement;
    expect(getComputedStyle(slot).transform).toBe("none");
    const row = slot.parentElement;
    expect(row?.querySelector("[data-slot='avatar']")).toBeTruthy();
    const arm = document.querySelector(".b-armL") as HTMLElement;
    expect(arm).toBeTruthy();
    expect(getComputedStyle(arm).opacity).not.toBe("0");
    const name = document.querySelector(".sd-winner-name");
    expect(getComputedStyle(name!).animationName).toBe("none");
    expect(Number(getComputedStyle(name!).opacity)).toBeGreaterThan(0.95);
  });
});
