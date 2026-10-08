import { closeDb } from ".";

function deleteNamedDatabase(name: string): Promise<void> {
  return new Promise((resolve, reject) => {
    let settled = false;
    const request = indexedDB.deleteDatabase(name);
    request.onsuccess = () => {
      if (settled) return;
      settled = true;
      resolve();
    };
    request.onerror = () => {
      if (settled) return;
      settled = true;
      reject(request.error ?? new Error(`Falha ao apagar ${name}`));
    };
    request.onblocked = () => {
      if (settled) return;
      settled = true;
      reject(new Error(`Apagar ${name} está bloqueado por outra aba`));
    };
  });
}

/**
 * Apaga o localStorage deste site e todos os IndexedDB.
 * Só deve rodar depois de uma confirmação explícita.
 * O localStorage só é limpo se os bancos forem apagados.
 */
export async function clearAllBrowserData(): Promise<void> {
  closeDb();
  const databases = await indexedDB.databases();
  const names = databases
    .map((database) => database.name)
    .filter((name): name is string => Boolean(name));
  await Promise.all(names.map((name) => deleteNamedDatabase(name)));
  localStorage.clear();
}
