import type { WinnerHistoryProvider } from "./history";
import { normalizeWinnerHistory, type WinnerHistorySource } from "./normalize";
import { compareWins, isCountedWin, makeUserKey, sameWin, sortWins } from "./order";
import type { GiveawayType, WinContext, WinEvent, WinRef } from "./types";

/**
 * Índice em memória `userKey → vitórias` na ordem total.
 *
 * Montado uma vez por sessão. Confirmar, remover e soft-delete
 * atualizam só o sorteio afetado (inserção ordenada), sem
 * remontar o histórico inteiro.
 *
 * A S11 troca a origem (`winner-events`) e continua entregando
 * `WinEvent[]` para este índice. `compute*` não muda.
 */

type IndexState = {
  ordered: WinEvent[];
  byUser: Map<string, WinEvent[]>;
};

export interface WinnerIndex extends WinnerHistoryProvider {
  readonly byUser: ReadonlyMap<string, readonly WinEvent[]>;
  /** Insere (ou substitui a mesma ref) na posição da ordem total. */
  insertWin(win: WinEvent): void;
  /**
   * Remove a ref e reindexa os vencedores seguintes do mesmo
   * sorteio, como o `filter` do array `winners`.
   */
  removeWin(ref: WinRef): void;
  /** Sorteio já com o vencedor gravado no array (append ou prepend). */
  confirmGiveaway(giveawayType: GiveawayType, record: unknown): void;
  /** Sorteio já sem o vencedor removido. */
  removeGiveawayWinner(giveawayType: GiveawayType, record: unknown): void;
  /**
   * Registro já soft-deleted. Vitórias que continuam em `winners`
   * permanecem. Não grava nada.
   */
  applySoftDelete(giveawayType: GiveawayType, record: unknown): void;
}

function copyContext(context: WinContext | undefined): WinContext | undefined {
  if (!context) return undefined;
  return { ...context };
}

function toStored(win: WinEvent): WinEvent | null {
  const userId = win.userId;
  if (!userId) return null;
  const platform = win.platform?.trim() ? win.platform.trim() : "twitch";
  const userKey = win.userKey || makeUserKey(platform, userId);
  if (!Number.isInteger(win.index) || win.index < 0) return null;
  const stored: WinEvent = {
    userKey,
    platform,
    userId,
    giveawayType: win.giveawayType,
    giveawayId: win.giveawayId,
    index: win.index,
    name: win.name ?? "",
  };
  if (win.wonAt) stored.wonAt = win.wonAt;
  if (win.avatar) stored.avatar = win.avatar;
  const context = copyContext(win.context);
  if (context) stored.context = context;
  if (!isCountedWin(stored)) return null;
  return stored;
}

function lowerBound(list: readonly WinEvent[], win: WinEvent): number {
  let lo = 0;
  let hi = list.length;
  while (lo < hi) {
    const mid = (lo + hi) >>> 1;
    const current = list[mid];
    if (current && compareWins(current, win) < 0) lo = mid + 1;
    else hi = mid;
  }
  return lo;
}

function readGiveawayId(record: unknown): string | null {
  if (!record || typeof record !== "object" || Array.isArray(record)) {
    return null;
  }
  const id = (record as { id?: unknown }).id;
  if (typeof id !== "string" || id.length === 0) return null;
  return id;
}

function sourceFor(
  giveawayType: GiveawayType,
  record: unknown,
): WinnerHistorySource {
  if (giveawayType === "chat") return { chat: [record] };
  if (giveawayType === "channel-points") return { channelPoints: [record] };
  return { subscribers: [record] };
}

function belongsTo(win: WinEvent, giveawayType: GiveawayType, id: string): boolean {
  return win.giveawayType === giveawayType && win.giveawayId === id;
}

function removeGiveawayWins(
  state: IndexState,
  giveawayType: GiveawayType,
  giveawayId: string,
): void {
  const keep = (win: WinEvent) => !belongsTo(win, giveawayType, giveawayId);
  state.ordered = state.ordered.filter(keep);
  for (const [userKey, list] of state.byUser) {
    let changed = false;
    for (const win of list) {
      if (!keep(win)) {
        changed = true;
        break;
      }
    }
    if (!changed) continue;
    const next = list.filter(keep);
    if (next.length === 0) state.byUser.delete(userKey);
    else state.byUser.set(userKey, next);
  }
}

function removeRef(state: IndexState, ref: WinRef, reindex: boolean): void {
  const found = state.ordered.find((win) => sameWin(win, ref));
  if (!found) return;
  const removedIndex = found.index;
  state.ordered = state.ordered.filter((win) => !sameWin(win, ref));
  const list = state.byUser.get(found.userKey);
  if (list) {
    const next = list.filter((win) => !sameWin(win, ref));
    if (next.length === 0) state.byUser.delete(found.userKey);
    else state.byUser.set(found.userKey, next);
  }
  if (!reindex) return;
  for (const win of state.ordered) {
    if (
      win.giveawayType === ref.giveawayType &&
      win.giveawayId === ref.giveawayId &&
      win.index > removedIndex
    ) {
      win.index -= 1;
    }
  }
}

function insertStored(state: IndexState, win: WinEvent): void {
  removeRef(state, win, false);
  const existing = state.byUser.get(win.userKey);
  const list = existing ?? [];
  list.splice(lowerBound(list, win), 0, win);
  if (!existing) state.byUser.set(win.userKey, list);
  state.ordered.splice(lowerBound(state.ordered, win), 0, win);
}

function replaceGiveaway(
  state: IndexState,
  giveawayType: GiveawayType,
  record: unknown,
): void {
  const giveawayId = readGiveawayId(record);
  if (!giveawayId) return;
  removeGiveawayWins(state, giveawayType, giveawayId);
  const wins = normalizeWinnerHistory(sourceFor(giveawayType, record));
  for (const win of wins) {
    const stored = toStored(win);
    if (stored) insertStored(state, stored);
  }
}

function bind(state: IndexState): WinnerIndex {
  return {
    get byUser() {
      return state.byUser;
    },
    getWins() {
      return state.ordered;
    },
    insertWin(win) {
      const stored = toStored(win);
      if (!stored) return;
      insertStored(state, stored);
    },
    removeWin(ref) {
      removeRef(state, ref, true);
    },
    confirmGiveaway(giveawayType, record) {
      replaceGiveaway(state, giveawayType, record);
    },
    removeGiveawayWinner(giveawayType, record) {
      replaceGiveaway(state, giveawayType, record);
    },
    applySoftDelete(giveawayType, record) {
      replaceGiveaway(state, giveawayType, record);
    },
  };
}

/** Agrupa vitórias já normalizadas. Não lê nem grava IndexedDB. */
export function createWinnerIndex(wins: readonly WinEvent[]): WinnerIndex {
  const stored: WinEvent[] = [];
  for (const win of wins) {
    const next = toStored(win);
    if (next) stored.push(next);
  }
  const ordered = sortWins(stored);
  const byUser = new Map<string, WinEvent[]>();
  for (const win of ordered) {
    const list = byUser.get(win.userKey);
    if (list) list.push(win);
    else byUser.set(win.userKey, [win]);
  }
  return bind({ ordered, byUser });
}

/**
 * Normaliza os três formatos v12 (inclui `deletedAt`) e monta o índice.
 * `participation` desconhecido é ignorado: a vitória sai de `winners`.
 */
export function createWinnerIndexFromSource(
  source: WinnerHistorySource | null | undefined,
): WinnerIndex {
  return createWinnerIndex(normalizeWinnerHistory(source));
}
