import { DATABASE_NAME, releaseLocalDatabase } from ".";

/**
 * Se `indexedDB.databases()` não existir, estes nomes ainda são apagados.
 * O app só cria `stream-drops-db`. Outro banco no mesmo site entra pela
 * lista de `databases()` quando a API existe.
 */
const KNOWN_DATABASE_NAMES = [DATABASE_NAME] as const;

/** Igual a `SIDEBAR_COOKIE_NAME` em `components/ui/sidebar.tsx`. */
const SIDEBAR_STATE_COOKIE = "sidebar_state";

export interface WipeLocalDataOptions {
  /**
   * Outra aba ainda segura algum banco. O wipe não limpa storage
   * enquanto isso; a promise segue até `onsuccess` ou `onerror`.
   */
  onBlocked?: (databaseName: string) => void;
}

function deleteNamedDatabase(
  name: string,
  onBlocked?: (databaseName: string) => void,
): Promise<void> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.deleteDatabase(name);
    request.onsuccess = () => resolve();
    request.onerror = () => {
      reject(request.error ?? new Error(`Falha ao apagar ${name}`));
    };
    request.onblocked = () => {
      onBlocked?.(name);
    };
  });
}

async function databaseNamesToDelete(): Promise<string[]> {
  const names = new Set<string>(KNOWN_DATABASE_NAMES);
  if (typeof indexedDB.databases !== "function") {
    return [...names];
  }
  let listed: Array<{ name?: string | null }> = [];
  try {
    listed = await indexedDB.databases();
  } catch {
    return [...names];
  }
  for (const database of listed) {
    if (database.name) names.add(database.name);
  }
  return [...names];
}

function expireSidebarStateCookie(): void {
  document.cookie = `${SIDEBAR_STATE_COOKIE}=; path=/; max-age=0`;
}

/**
 * Apaga os dados locais deste site. Só deve rodar depois da
 * confirmação explícita (digitar APAGAR, ou a caixa do logout).
 *
 * Ordem: fecha a conexão (`closeDb`, via `releaseLocalDatabase`),
 * apaga os IndexedDB e só então localStorage, sessionStorage e o
 * cookie `sidebar_state`. Se outra aba segura o banco, nada disso
 * é limpo até o delete concluir.
 *
 * O token da Twitch sai do `localStorage` junto com o resto.
 * Esta função não revoga o token na Twitch.
 */
export async function wipeLocalData(
  options: WipeLocalDataOptions = {},
): Promise<void> {
  await releaseLocalDatabase();
  const names = await databaseNamesToDelete();
  const ordered = [
    ...names.filter((name) => name === DATABASE_NAME),
    ...names.filter((name) => name !== DATABASE_NAME),
  ];
  for (const name of ordered) {
    await deleteNamedDatabase(name, options.onBlocked);
  }
  localStorage.clear();
  sessionStorage.clear();
  expireSidebarStateCookie();
}

/** @deprecated Use `wipeLocalData`. */
export function clearAllBrowserData(): Promise<void> {
  return wipeLocalData();
}
