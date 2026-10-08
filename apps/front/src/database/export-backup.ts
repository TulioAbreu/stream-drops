import { DATABASE_NAME } from ".";

export const BACKUP_APP = "stream-drops" as const;
export const BACKUP_FORMAT = 1 as const;

/**
 * Backup só de leitura do IndexedDB `stream-drops-db`.
 * Não inclui localStorage (token, `login-storage`, tema) nem cookies.
 * `format: 1` deixa espaço para um import futuro; esta fase não importa.
 */
export interface StreamDropsBackup {
  app: typeof BACKUP_APP;
  format: typeof BACKUP_FORMAT;
  dbVersion: number;
  exportedAt: string;
  stores: Record<string, unknown[]>;
}

export interface ReadBackupOptions {
  now?: () => string;
}

async function databaseExists(): Promise<boolean> {
  const databases = await indexedDB.databases();
  return databases.some((database) => database.name === DATABASE_NAME);
}

/**
 * Abre o banco já existente sem passar versão, para não disparar upgrade
 * nem criar stores. Se o banco não existe, o chamador não deve abrir.
 */
function openExistingDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DATABASE_NAME);
    request.onupgradeneeded = () => {
      request.transaction?.abort();
      request.result.close();
      reject(new Error("O backup não pode criar nem atualizar o banco"));
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function readAllStores(
  db: IDBDatabase,
): Promise<Record<string, unknown[]>> {
  const names = Array.from(db.objectStoreNames);
  if (names.length === 0) {
    return Promise.resolve({});
  }

  return new Promise((resolve, reject) => {
    const tx = db.transaction(names, "readonly");
    const stores: Record<string, unknown[]> = {};

    tx.oncomplete = () => resolve(stores);
    tx.onerror = () => reject(tx.error);
    tx.onabort = () =>
      reject(tx.error ?? new Error("Leitura do backup abortada"));

    for (const name of names) {
      const request = tx.objectStore(name).getAll();
      request.onsuccess = () => {
        stores[name] = request.result as unknown[];
      };
      request.onerror = () => reject(request.error);
    }
  });
}

export async function readLocalDatabaseBackup(
  options: ReadBackupOptions = {},
): Promise<StreamDropsBackup> {
  const exportedAt = (options.now ?? (() => new Date().toISOString()))();

  if (!(await databaseExists())) {
    return {
      app: BACKUP_APP,
      format: BACKUP_FORMAT,
      dbVersion: 0,
      exportedAt,
      stores: {},
    };
  }

  const db = await openExistingDatabase();
  try {
    const stores = await readAllStores(db);
    return {
      app: BACKUP_APP,
      format: BACKUP_FORMAT,
      dbVersion: db.version,
      exportedAt,
      stores,
    };
  } finally {
    db.close();
  }
}

export function serializeBackup(backup: StreamDropsBackup): string {
  return JSON.stringify(backup, null, 2);
}

export function backupFilename(exportedAt: string): string {
  const stamp = exportedAt.replace(/[:.]/g, "-");
  return `stream-drops-backup-${stamp}.json`;
}

/** Dispara o download do JSON. Não grava no IndexedDB nem no localStorage. */
export function downloadLocalDatabaseBackup(backup: StreamDropsBackup): void {
  const blob = new Blob([serializeBackup(backup)], {
    type: "application/json",
  });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = backupFilename(backup.exportedAt);
  anchor.rel = "noopener";
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}
