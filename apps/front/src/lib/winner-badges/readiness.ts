import { useEffect, useMemo } from "react";
import { create } from "zustand";
import type { WinnerHistoryProvider } from "./history";
import { buildWinnerIndexFromDatabase } from "./indexed-db-source";
import { collectWinAwards, selectForDisplay, type DisplaySelection } from "./select-for-display";
import type { EngineClock, GiveawayType, WinEvent } from "./types";
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
  /** Sobe quando a memória muda, para a UI recalcular sem persistir. */
  revision: number;
};

type MemoryNote =
  | {
      kind: "replace";
      op: "confirm" | "remove" | "soft";
      giveawayType: GiveawayType;
      record: unknown;
    }
  | {
      kind: "hard";
      giveawayType: GiveawayType;
      giveawayId: string;
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
  revision: 0,
};

let pendingNotes: MemoryNote[] = [];

function applyMemoryNote(index: WinnerIndex, note: MemoryNote): void {
  if (note.kind === "hard") {
    index.applyHardDelete(note.giveawayType, note.giveawayId);
    return;
  }
  if (note.op === "confirm") {
    index.confirmGiveaway(note.giveawayType, note.record);
    return;
  }
  if (note.op === "remove") {
    index.removeGiveawayWinner(note.giveawayType, note.record);
    return;
  }
  index.applySoftDelete(note.giveawayType, note.record);
}

function drainMemoryNotes(index: WinnerIndex): void {
  while (pendingNotes.length > 0) {
    const note = pendingNotes.shift();
    if (note) applyMemoryNote(index, note);
  }
}

function remember(note: MemoryNote): void {
  const { status, index } = useWinnerIndexStore.getState();
  if (status !== "ready" || !index) {
    pendingNotes.push(note);
    return;
  }
  applyMemoryNote(index, note);
  useWinnerIndexStore.setState((state) => ({
    revision: state.revision + 1,
  }));
}

export const useWinnerIndexStore = create<WinnerIndexState>()(() => initialState);

const MAX_LOAD_ATTEMPTS = 3;
const RETRY_BACKOFF_MS = [200, 600];

let generation = 0;
let attempt = 0;
let inFlight = false;
let optionsCaptured = false;
let sessionOptions: WinnerIndexLoadOptions | undefined;
let retryTimer: ReturnType<typeof setTimeout> | null = null;

function clearRetryTimer(): void {
  if (retryTimer === null) return;
  clearTimeout(retryTimer);
  retryTimer = null;
}

export function resetWinnerIndexSession(): void {
  generation += 1;
  attempt = 0;
  inFlight = false;
  optionsCaptured = false;
  sessionOptions = undefined;
  pendingNotes = [];
  clearRetryTimer();
  useWinnerIndexStore.setState({
    status: "loading",
    index: null,
    error: null,
    provider: EMPTY_PROVIDER,
    revision: 0,
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

function beginLoad(): void {
  if (inFlight) return;
  if (attempt >= MAX_LOAD_ATTEMPTS) return;
  if (useWinnerIndexStore.getState().status === "ready") return;
  clearRetryTimer();
  inFlight = true;
  attempt += 1;
  const token = generation;
  const currentAttempt = attempt;
  useWinnerIndexStore.setState({
    status: "loading",
    index: null,
    error: null,
    provider: EMPTY_PROVIDER,
  });
  void loadFrom(sessionOptions).then(
    (index) => {
      if (token !== generation) return;
      inFlight = false;
      clearRetryTimer();
      drainMemoryNotes(index);
      useWinnerIndexStore.setState((state) => ({
        status: "ready",
        index,
        error: null,
        provider: index,
        revision: state.revision + 1,
      }));
      if (pendingNotes.length > 0) {
        drainMemoryNotes(index);
        useWinnerIndexStore.setState((state) => ({
          revision: state.revision + 1,
        }));
      }
    },
    (error: unknown) => {
      if (token !== generation) return;
      inFlight = false;
      useWinnerIndexStore.setState({
        status: "error",
        index: null,
        error,
        provider: EMPTY_PROVIDER,
      });
      if (currentAttempt >= MAX_LOAD_ATTEMPTS) return;
      const delay = RETRY_BACKOFF_MS[currentAttempt - 1] ?? 600;
      retryTimer = setTimeout(() => {
        retryTimer = null;
        if (token !== generation) return;
        beginLoad();
      }, delay);
    },
  );
}

/**
 * Soft-delete já gravado. Atualiza só o sorteio afetado.
 * Sem índice pronto, a próxima carga lê o registro podado.
 * Não abre transação.
 */
export function noteGiveawaySoftDeleted(
  giveawayType: GiveawayType,
  record: unknown,
): void {
  remember({ kind: "replace", op: "soft", giveawayType, record });
}

/** Hard delete já gravado. Tira as vitórias desse sorteio da memória. */
export function noteGiveawayHardDeleted(
  giveawayType: GiveawayType,
  giveawayId: string,
): void {
  remember({ kind: "hard", giveawayType, giveawayId });
}

/**
 * Confirmação já gravada. Atualiza só a memória.
 * Não abre transação e não altera o registro.
 */
export function noteGiveawayConfirmed(
  giveawayType: GiveawayType,
  record: unknown,
): void {
  remember({ kind: "replace", op: "confirm", giveawayType, record });
}

/** Remoção já gravada. Atualiza só a memória. */
export function noteGiveawayWinnerRemoved(
  giveawayType: GiveawayType,
  record: unknown,
): void {
  remember({ kind: "replace", op: "remove", giveawayType, record });
}

/**
 * Uma carga bem-sucedida por sessão. A segunda chamada não relê.
 * Falha tenta de novo, com backoff curto e no máximo 3 vezes.
 */
export function startWinnerIndex(options?: WinnerIndexLoadOptions): void {
  if (optionsCaptured) return;
  optionsCaptured = true;
  sessionOptions = options;
  beginLoad();
}

/** O card puxa a próxima tentativa sem esperar o backoff. */
function retryWinnerIndexFromCard(): void {
  if (useWinnerIndexStore.getState().status !== "error") return;
  if (inFlight || attempt >= MAX_LOAD_ATTEMPTS) return;
  beginLoad();
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

/** Selos da vitória já confirmada. Sem índice pronto, vazio na hora. */
export function readConfirmedBadges(
  status: WinnerIndexStatus,
  provider: WinnerHistoryProvider,
  win: WinEvent,
  clock: EngineClock,
): DisplaySelection {
  if (status !== "ready") return EMPTY_CARD_SELECTION;
  return selectForDisplay(collectWinAwards(provider, win, clock));
}

function useBadgeRevision(): number {
  return useWinnerIndexStore((state) => state.revision);
}

export function useCardBadges(
  win: WinEvent,
  clock: EngineClock,
): { status: WinnerIndexStatus; selection: DisplaySelection } {
  const status = useWinnerIndexStore((state) => state.status);
  const provider = useWinnerIndexStore((state) => state.provider);
  const revision = useBadgeRevision();
  useEffect(() => {
    if (status !== "error") return;
    retryWinnerIndexFromCard();
  }, [status]);
  const selection = useMemo(() => {
    void revision;
    return readCardBadges(status, provider, win, clock);
  }, [status, provider, win, clock, revision]);
  return { status, selection };
}

export function useConfirmedBadges(
  win: WinEvent,
  clock: EngineClock,
): { status: WinnerIndexStatus; selection: DisplaySelection } {
  const status = useWinnerIndexStore((state) => state.status);
  const provider = useWinnerIndexStore((state) => state.provider);
  const revision = useBadgeRevision();
  useEffect(() => {
    if (status !== "error") return;
    retryWinnerIndexFromCard();
  }, [status]);
  const selection = useMemo(() => {
    void revision;
    return readConfirmedBadges(status, provider, win, clock);
  }, [status, provider, win, clock, revision]);
  return { status, selection };
}
