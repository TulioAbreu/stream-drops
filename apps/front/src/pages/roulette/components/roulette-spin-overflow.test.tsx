import { useState } from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import "@/i18n";
import { RouletteWheel } from "./roulette-wheel";

function SpinHarness() {
  const [mustSpin, setMustSpin] = useState(false);
  return (
    <>
      <div
        data-scroll-probe
        style={{ width: 480, height: 520, overflow: "auto" }}
      >
        <RouletteWheel
          options={["Alice", "Bob", "Carol", "Diana"]}
          mustSpin={mustSpin}
          prizeIndex={0}
          onStopSpinning={() => undefined}
        />
      </div>
      <button type="button" onClick={() => setMustSpin(true)}>
        Girar
      </button>
    </>
  );
}

describe("overflow do giro da roleta", () => {
  it("não altera a altura rolável enquanto a roda gira", async () => {
    render(<SpinHarness />);
    await waitFor(() => {
      expect(
        document.querySelector("[data-roulette-wheel] canvas"),
      ).toBeTruthy();
    });

    const probe = document.querySelector("[data-scroll-probe]");
    if (!(probe instanceof HTMLElement)) {
      throw new Error("probe ausente");
    }
    const clip = document.querySelector(".roulette-wheel-orient > div");
    expect(clip).toBeTruthy();
    expect(getComputedStyle(clip!).overflow).toBe("clip");

    const before = probe.scrollHeight;
    fireEvent.click(screen.getByRole("button", { name: "Girar" }));

    const started = Date.now();
    const seen = new Set<number>([before]);
    while (Date.now() - started < 1200) {
      seen.add(probe.scrollHeight);
      await new Promise((resolve) => setTimeout(resolve, 40));
    }

    expect([...seen]).toEqual([before]);
  });
});
