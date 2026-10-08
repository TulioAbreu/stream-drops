import { DATABASE_NAME } from ".";

export async function databaseExists(): Promise<boolean> {
  const databases = await indexedDB.databases();
  return databases.some((database) => database.name === DATABASE_NAME);
}

/**
 * Abre o banco já existente sem passar versão, para não disparar upgrade
 * nem criar stores. Se o banco não existe, o chamador não deve abrir.
 */
export function openExistingDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DATABASE_NAME);
    request.onupgradeneeded = () => {
      request.transaction?.abort();
      request.result.close();
      reject(new Error("A leitura não pode criar nem atualizar o banco"));
    };
    request.onsuccess = () => {
      const db = request.result;
      db.onversionchange = () => {
        db.close();
      };
      resolve(db);
    };
    request.onerror = () => reject(request.error);
  });
}
