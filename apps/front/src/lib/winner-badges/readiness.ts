import { useMemo } from "react";
import { create } from "zustand";
import type { WinnerHistoryProvider } from "./history";
import { buildWinnerIndexFromDatabase } from "./indexed-db-source";
import { collectWinAwards, selectForDisplay, type DisplaySelection } from "./select-for-display";
import type { EngineClock, WinEvent } from "./types";
import type { WinnerHistorySource } from "./normalize";
import { createWinnerIndexFromSource, type WinnerIndex } from "./win-index";

/**
 * Prontidão do índice, sem bloquear quem desenha o card (CA25).
 *
 * Enquanto `status !== "ready"`, os selos são uma seleção vazia.
 * A S8 só lê este estado. A S11 troca o `read` da carga, não o store.
 * Este módulo não usa `persist`: não cria chave de storage.
 */

export type WinnerIndexStatus = "loading" | "ready" | "error";

export type WinnerIndexLoadOptions = {
  /** Só para o teste do CA25. A carga real não atrasa de propósito. */
  delayMs?: number;
  /**
   * Origem da carga. O padrão é o IndexedDB v12.
   * A S11 passa a leitura de `winner-events`.
   */
  read?: () => Promise<WinnerHistorySource>;
};

type WinnerIndexState = {
  status: WinnerIndexStatus;
  index: WinnerIndex | null;
  error: unknown;
  provider: WinnerHistoryProvider;
};

const EMPTY_WINS: readonly WinEvent[] = Object.freeze([]);

const EMPTY_PROVIDER: WinnerHistoryProvider = {
  getWins() {
    return EMPTY_WINS;
  },
};

export const EMPTY_CARD_SELECTION: DisplaySelection = {
  card: [],
  cardOverflow: 0,
  log: [],
  logOverflow: 0,
  tooltip: [],
  highlight: null,
};

const initialState: WinnerIndexState = {
  status: "loading",
  index: null,
  error: null,
  provider: EMPTY_PROVIDER,
};

export const useWinnerIndexStore = create<WinnerIndexState>()(() => initialState);

let generation = 0;
let started = false;

export function resetWinnerIndexSession(): void {
  generation += 1;
  started = false;
  useWinnerIndexStore.setState({
    status: "loading",
    index: null,
    error: null,
    provider: EMPTY_PROVIDER,
  });
}

async function loadFrom(options?: WinnerIndexLoadOptions): Promise<WinnerIndex> {
  const delayMs = options?.delayMs ?? 0;
  if (delayMs > 0) {
    await new Promise<void>((resolve) => {
      setTimeout(resolve, delayMs);
    });
  }
  if (!options?.read) return buildWinnerIndexFromDatabase();
  const source = await options.read();
  return createWinnerIndexFromSource(source);
}

/** Uma carga por sessão. A segunda chamada não relê o banco. */
export function startWinnerIndex(options?: WinnerIndexLoadOptions): void {
  if (started) return;
  started = true;
  const token = generation;
  useWinnerIndexStore.setState({
    status: "loading",
    index: null,
    error: null,
    provider: EMPTY_PROVIDER,
  });
  void loadFrom(options).then(
    (index) => {
      if (token !== generation) return;
      useWinnerIndexStore.setState({
        status: "ready",
        index,
        error: null,
        provider: index,
      });
    },
    (error: unknown) => {
      if (token !== generation) return;
      useWinnerIndexStore.setState({
        status: "error",
        index: null,
        error,
        provider: EMPTY_PROVIDER,
      });
    },
  );
}

/**
 * Selos do card. Sem índice pronto, devolve vazio na hora
 * e não chama o motor.
 */
export function readCardBadges(
  status: WinnerIndexStatus,
  provider: WinnerHistoryProvider,
  win: WinEvent,
  clock: EngineClock,
): DisplaySelection {
  if (status !== "ready") return EMPTY_CARD_SELECTION;
  return selectForDisplay(collectWinAwards(provider, win, clock, { preview: win }));
}

export function useCardBadges(
  win: WinEvent,
  clock: EngineClock,
): { status: WinnerIndexStatus; selection: DisplaySelection } {
  const status = useWinnerIndexStore((state) => state.status);
  const provider = useWinnerIndexStore((state) => state.provider);
  const selection = useMemo(
    () => readCardBadges(status, provider, win, clock),
    [status, provider, win, clock],
  );
  return { status, selection };
}
