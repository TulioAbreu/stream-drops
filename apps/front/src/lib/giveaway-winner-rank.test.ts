import { describe, it, expect } from "vitest";
import { sortWinnersByDrawOrder } from "./giveaway-winner-rank";

describe("sortWinnersByDrawOrder", () => {
  it("U1: ordena em ordem cronológica ascendente por drawnAt", () => {
    const winners = [
      { id: "c", drawnAt: "2026-10-08T12:10:00Z" },
      { id: "a", drawnAt: "2026-10-08T12:00:00Z" },
      { id: "b", drawnAt: "2026-10-08T12:05:00Z" },
    ];

    const sorted = sortWinnersByDrawOrder(winners);

    expect(sorted.map((w) => w.id)).toEqual(["a", "b", "c"]);
  });

  it("U1: desempata pelo índice original quando drawnAt é igual", () => {
    const winners = [
      { id: "x", drawnAt: "2026-10-08T12:00:00Z" },
      { id: "y", drawnAt: "2026-10-08T12:00:00Z" },
      { id: "z", drawnAt: "2026-10-08T12:00:00Z" },
    ];

    const sorted = sortWinnersByDrawOrder(winners);

    expect(sorted.map((w) => w.id)).toEqual(["x", "y", "z"]);
  });

  it("U2: não muta o array original", () => {
    const winners = [
      { id: "b", drawnAt: "2026-10-08T12:05:00Z" },
      { id: "a", drawnAt: "2026-10-08T12:00:00Z" },
    ];
    const original = [...winners];

    sortWinnersByDrawOrder(winners);

    expect(winners).toEqual(original);
  });
});
