import { describe, expect, it } from "vitest";
import "@/i18n";
import {
  SLICE_TOKENS,
  TEXT_TOKENS,
  contrast,
  readToken,
  slicePaint,
} from "./roulette-palette";

describe("paleta da roleta", () => {
  it("escolhe tinta com contraste AA em cada fatia, nos dois temas", () => {
    const root = document.documentElement;
    for (const theme of ["dark", "light"] as const) {
      root.classList.remove("dark", "light");
      root.classList.add(theme);
      const inks = TEXT_TOKENS.map(readToken).filter(Boolean);
      expect(inks.length).toBeGreaterThan(0);
      for (const token of SLICE_TOKENS) {
        const fill = readToken(token);
        expect(fill, `${theme} ${token}`).not.toBe("");
        const paint = slicePaint(fill, inks);
        expect(
          contrast(paint.background, paint.text),
          `${theme} ${token}`,
        ).toBeGreaterThanOrEqual(4.5);
      }
    }
    root.classList.remove("light");
    root.classList.add("dark");
  });
});
