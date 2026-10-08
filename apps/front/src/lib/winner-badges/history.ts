import { isCountedWin, sameWin } from "./order";
import type { WinEvent } from "./types";

/**
 * Fonte do histórico. A S2 implementa com IndexedDB
 * (incluindo soft-deleted). A S11 pode trocar a origem
 * para `winner-events` sem mudar esta interface.
 * `getWins` devolve o snapshot atual; o motor não o muta.
 */
export interface WinnerHistoryProvider {
  getWins(): readonly WinEvent[];
}

export function createMemoryHistoryProvider(
  wins: readonly WinEvent[],
): WinnerHistoryProvider {
  return {
    getWins() {
      return wins;
    },
  };
}

/** Prévia: `wonAt` passa a ser o `now` injetado. Não grava nada. */
export function toPreview(win: WinEvent, now: string): WinEvent {
  return { ...win, wonAt: now, preview: true };
}

/**
 * Cópia do snapshot + prévia opcional.
 * A prévia substitui um evento com a mesma ref, se existir,
 * e nunca é escrita de volta no provider.
 */
export function loadWins(
  provider: WinnerHistoryProvider,
  preview?: WinEvent,
): WinEvent[] {
  const base = provider.getWins().filter(isCountedWin);
  if (!preview) return [...base];
  const hypothetical = { ...preview, preview: true as const };
  return [
    ...base.filter((win) => !sameWin(win, hypothetical)),
    hypothetical,
  ];
}
