import { describe, expect, it } from "vitest";
import {
  reverseWinnersForDisplay,
  sortWinnersByDrawOrder,
} from "./giveaway-winner-rank";

describe("sortWinnersByDrawOrder", () => {
  it("U1: ordena asc por drawnAt e desempata pelo índice original", () => {
    const winners = [
      { id: "c", drawnAt: "2026-10-08T12:10:00Z" },
      { id: "a", drawnAt: "2026-10-08T12:00:00Z" },
      { id: "tie-2", drawnAt: "2026-10-08T12:05:00Z" },
      { id: "b", drawnAt: "2026-10-08T12:05:00Z" },
    ];

    const sorted = sortWinnersByDrawOrder(winners);

    expect(sorted.map((winner) => winner.id)).toEqual([
      "a",
      "tie-2",
      "b",
      "c",
    ]);
    expect(winners.map((winner) => winner.id)).toEqual([
      "c",
      "a",
      "tie-2",
      "b",
    ]);
  });

  it("U2: a inversão de Subscribers não muta o array original", () => {
    const saved = [
      { user_id: "c" },
      { user_id: "b" },
      { user_id: "a" },
    ];
    const snapshot = saved.map((winner) => winner.user_id);

    const display = reverseWinnersForDisplay(saved);

    expect(display.map((winner) => winner.user_id)).toEqual(["a", "b", "c"]);
    expect(saved.map((winner) => winner.user_id)).toEqual(snapshot);
    expect(display).not.toBe(saved);
  });
});
