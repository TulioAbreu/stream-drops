import { parseInstant } from "./datetime";
import type { WinEvent, WinRef } from "./types";

const UNKNOWN_USER_ID = "unknown";

export function makeUserKey(
  platform: string | null | undefined,
  userId: string,
): string {
  const trimmed = platform?.trim() ?? "";
  const resolved = trimmed.length > 0 ? trimmed : "twitch";
  return `${resolved}:${userId}`;
}

export function hasWonAt(win: WinEvent): boolean {
  return parseInstant(win.wonAt) !== null;
}

/** Identidade `"unknown"` ou vazia fica fora de tudo (CA15). */
export function isCountedWin(win: WinEvent): boolean {
  if (!win.userId || win.userId === UNKNOWN_USER_ID) return false;
  if (!win.giveawayId) return false;
  if (!win.userKey || win.userKey.endsWith(`:${UNKNOWN_USER_ID}`)) {
    return false;
  }
  return true;
}

export function winRef(win: WinEvent): WinRef {
  return {
    giveawayType: win.giveawayType,
    giveawayId: win.giveawayId,
    index: win.index,
  };
}

export function sameWin(a: WinRef, b: WinRef): boolean {
  return (
    a.giveawayType === b.giveawayType &&
    a.giveawayId === b.giveawayId &&
    a.index === b.index
  );
}

/**
 * Ordem total `(wonAt, giveawayId, índice)`.
 * Vitórias sem data vêm antes das datadas: são legado e
 * anulam um Primeiro Drop posterior, sem entrar na linha do tempo.
 * `giveawayType` desempata ids iguais em stores diferentes.
 */
export function compareWins(a: WinEvent, b: WinEvent): number {
  const aMs = parseInstant(a.wonAt);
  const bMs = parseInstant(b.wonAt);
  const aDated = aMs !== null;
  const bDated = bMs !== null;
  if (aDated !== bDated) return aDated ? 1 : -1;
  if (aDated && bDated && aMs !== bMs) return aMs - bMs;
  if (a.giveawayId !== b.giveawayId) {
    return a.giveawayId < b.giveawayId ? -1 : 1;
  }
  if (a.giveawayType !== b.giveawayType) {
    return a.giveawayType < b.giveawayType ? -1 : 1;
  }
  return a.index - b.index;
}

export function sortWins(wins: readonly WinEvent[]): WinEvent[] {
  return [...wins].sort(compareWins);
}
