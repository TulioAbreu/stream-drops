import { openDb } from "@/database";
import type { WinnerHistorySource } from "./normalize";
import { createWinnerIndexFromSource, type WinnerIndex } from "./win-index";

/**
 * Leitura do histórico no `stream-drops-db` v12.
 *
 * Só `readonly`. Não cria store, não dá bump e não grava.
 * Em Subscribers, `drawnAt` vira `wonAt` quando existe; sem ele,
 * a vitória conta nos totais e fica fora dos selos temporais.
 * No Chat, o Fiel lê `winner.context` e, se o campo não existe,
 * junta com `participants`.
 * `chat-participants` fica para o índice de participação (M3):
 * o M1 emite as vitórias a partir dos três sorteios.
 *
 * A S11 substitui este módulo por `winner-events`. O índice
 * em memória e o `WinnerHistoryProvider` continuam.
 */

export const WINNER_HISTORY_STORES = {
  chat: "chat-giveaways",
  channelPoints: "channel-points-giveaways",
  subscribers: "giveaways",
} as const;

const STORE_LIST = [
  WINNER_HISTORY_STORES.chat,
  WINNER_HISTORY_STORES.channelPoints,
  WINNER_HISTORY_STORES.subscribers,
] as const;

function readStores(db: IDBDatabase, names: readonly string[]): Promise<unknown[][]> {
  return new Promise((resolve, reject) => {
    const tx = db.transaction([...names], "readonly");
    const rows: unknown[][] = names.map(() => []);
    names.forEach((name, index) => {
      const request = tx.objectStore(name).getAll();
      request.onsuccess = () => {
        rows[index] = request.result as unknown[];
      };
    });
    tx.oncomplete = () => resolve(rows);
    tx.onerror = () => reject(tx.error ?? new Error("Falha ao ler o histórico"));
    tx.onabort = () => reject(tx.error ?? new Error("Leitura do histórico abortada"));
  });
}

/** `getAll` dos três sorteios. Não abre transação de escrita. */
export async function readWinnerHistorySource(): Promise<WinnerHistorySource> {
  const db = await openDb();
  const [chat, channelPoints, subscribers] = await readStores(db, STORE_LIST);
  return { chat, channelPoints, subscribers };
}

/**
 * M1: `getAll` + normalização + `Map` ordenado.
 * Não escreve no IndexedDB, localStorage, sessionStorage ou cookie.
 */
export async function buildWinnerIndexFromDatabase(): Promise<WinnerIndex> {
  const source = await readWinnerHistorySource();
  return createWinnerIndexFromSource(source);
}
