import { useEffect, useRef } from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cdp } from "vitest/browser";
import "@/i18n";
import { clearDatabase } from "@/database";
import { DATABASE_VERSION } from "@/database";
import { useRouletteDb, type RouletteData } from "@/database/Roulette";
import { RouletteEditor } from "./roulette-editor";

const confetti = vi.hoisted(() => vi.fn());

vi.mock("canvas-confetti", () => ({
  default: confetti,
}));

vi.mock("@/service/roulette", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/service/roulette")>();
  return {
    ...actual,
    pickWinnerIndex: () => 0,
  };
});

vi.mock("react-custom-roulette", () => ({
  Wheel: function MockWheel(props: {
    mustStartSpinning: boolean;
    onStopSpinning: () => void;
  }) {
    const { mustStartSpinning, onStopSpinning } = props;
    const cb = useRef(onStopSpinning);
    cb.current = onStopSpinning;
    const spun = useRef(false);
    useEffect(() => {
      if (!mustStartSpinning) {
        spun.current = false;
        return;
      }
      if (spun.current) return;
      spun.current = true;
      cb.current();
    }, [mustStartSpinning]);
    return <div data-testid="roulette-wheel" />;
  },
}));

/* eslint-disable react-hooks/rules-of-hooks */
const { addRoulette, getRoulette } = useRouletteDb();
/* eslint-enable react-hooks/rules-of-hooks */

const saved: RouletteData = {
  id: "roulette-1",
  title: "Roleta de Prêmios da Live",
  options: ["Alice", "Bob", "Carol"],
  createdAt: "2020-01-01T00:00:00.000Z",
  updatedAt: "2020-01-01T00:00:00.000Z",
};

function renderEditor(mode: "new" | "edit" = "new", initial?: RouletteData) {
  return render(
    <MemoryRouter>
      <RouletteEditor mode={mode} initialData={initial} />
    </MemoryRouter>,
  );
}

describe("RouletteEditor", () => {
  beforeEach(async () => {
    confetti.mockClear();
    await clearDatabase();
  });

  afterEach(async () => {
    const client = cdp();
    await client.send("Emulation.setEmulatedMedia", { features: [] });
  });

  it("mostra o painel de itens e o palco parado", () => {
    renderEditor();
    expect(screen.getByRole("heading", { name: "Nova Roleta" })).toBeTruthy();
    expect(screen.getByText("Itens da roleta")).toBeTruthy();
    expect(screen.getByText("Pronta para girar")).toBeTruthy();
    expect(screen.getByText("0 prêmios na roda")).toBeTruthy();
    expect(
      (screen.getByRole("button", { name: "Girar" }) as HTMLButtonElement)
        .disabled,
    ).toBe(true);
  });

  it("gira, abre o resultado e o Esc não fecha o palco", async () => {
    renderEditor();
    fireEvent.change(screen.getByLabelText("Opções"), {
      target: { value: "Alice\nBob" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Girar" }));

    const dialog = await screen.findByRole("dialog", { name: "Alice" });
    expect(screen.getByText("Resultado da roleta")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Confirmar" })).toBeNull();

    fireEvent.keyDown(dialog, { key: "Escape" });
    expect(screen.getByRole("dialog", { name: "Alice" })).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Continuar" }));
    await waitFor(() => {
      expect(screen.queryByRole("dialog", { name: "Alice" })).toBeNull();
    });
    expect(screen.getByText("Último resultado")).toBeTruthy();
    expect(screen.getByText("Alice")).toBeTruthy();
  });

  it("não grava o resultado do giro no store roulettes", async () => {
    expect(DATABASE_VERSION).toBe(12);
    await addRoulette(saved);
    renderEditor("edit", saved);

    fireEvent.click(screen.getByRole("button", { name: "Girar" }));
    await screen.findByRole("dialog", { name: "Alice" });
    fireEvent.click(screen.getByRole("button", { name: "Continuar" }));

    expect(await getRoulette(saved.id)).toEqual(saved);
  });

  it("com prefers-reduced-motion não solta confete", async () => {
    const client = cdp();
    await client.send("Emulation.setEmulatedMedia", {
      features: [{ name: "prefers-reduced-motion", value: "reduce" }],
    });
    renderEditor("edit", saved);
    fireEvent.click(screen.getByRole("button", { name: "Girar" }));
    await screen.findByRole("dialog", { name: "Alice" });
    await new Promise((resolve) => setTimeout(resolve, 40));
    expect(confetti).not.toHaveBeenCalled();
    const stage = document.querySelector("[data-winner-moment]");
    expect(stage?.getAttribute("data-motion")).toBe("reduced");
    const wheel = document.querySelector("[data-roulette-wheel]");
    expect(wheel?.getAttribute("data-motion")).toBe("reduced");
  });
});
