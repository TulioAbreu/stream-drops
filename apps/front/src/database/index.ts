export const DATABASE_NAME = "stream-drops-db";
export const DATABASE_VERSION = 12;

// Singleton cache for database connection
let dbInstance: IDBDatabase | null = null;
let dbPromise: Promise<IDBDatabase> | null = null;
/**
 * Sobe no closeDb(). Um open que termina depois disso fecha a
 * conexão e não vira o singleton — senão o wipe recriaria o banco.
 */
let connectionEpoch = 0;

interface DatabaseTable {
    name: string;
    primaryKey: {
        keyPath: string;
        options?: IDBObjectStoreParameters;
    };
    indexes?: {
        name: string;
        keyPath: string;
        options?: IDBIndexParameters;
    }[];
}

export const DATABASE_STORES: DatabaseTable[] = [
    {
        name: "exclusion-list",
        primaryKey: {
            keyPath: "twitchUserId",
            options: { keyPath: "twitchUserId" }
        },
        indexes: [
            {
                name: "username",
                keyPath: "username",
                options: { unique: true }
            }
        ]
    },
    {
        name: "giveaways",
        primaryKey: {
            keyPath: "id",
            options: { keyPath: "id" }
        }
    },
    {
        name: "chat-giveaways",
        primaryKey: {
            keyPath: "id",
            options: { keyPath: "id" }
        }
    },
    {
        name: "chat-giveaway-templates",
        primaryKey: {
            keyPath: "id",
            options: { keyPath: "id" }
        }
    },
    {
        name: "chat-participants",
        primaryKey: {
            keyPath: "id",
            options: { keyPath: "id" }
        },
        indexes: [
            {
                name: "giveawayId",
                keyPath: "giveawayId",
                options: { unique: false }
            },
            {
                name: "userId",
                keyPath: "userId",
                options: { unique: false }
            }
        ]
    },
    {
        name: "roulettes",
        primaryKey: {
            keyPath: "id",
            options: { keyPath: "id" }
        }
    },
    {
        name: "channel-points-giveaways",
        primaryKey: {
            keyPath: "id",
            options: { keyPath: "id" }
        }
    }
];

export function openDb(): Promise<IDBDatabase> {
    // Return cached instance if available
    if (dbInstance) {
        return Promise.resolve(dbInstance);
    }

    // Return pending promise if connection is in progress
    if (dbPromise) {
        return dbPromise;
    }

    // Create new connection
    const epoch = connectionEpoch;
    dbPromise = new Promise<IDBDatabase>((resolve, reject) => {
        console.log(`🗄️ Abrindo banco de dados: ${DATABASE_NAME} v${DATABASE_VERSION}`);
        const request = indexedDB.open(DATABASE_NAME, DATABASE_VERSION);

        request.onupgradeneeded = () => {
            if (epoch !== connectionEpoch) {
                request.transaction?.abort();
                return;
            }
            console.log(`🔧 Atualizando banco de dados para versão ${DATABASE_VERSION}`);
            const db = request.result;

            DATABASE_STORES.forEach(store => {
                if (!db.objectStoreNames.contains(store.name)) {
                    console.log(`📦 Criando tabela: ${store.name}`);
                    const objectStore = db.createObjectStore(store.name, store.primaryKey.options);

                    // Create indexes if they exist
                    if (store.indexes) {
                        store.indexes.forEach(index => {
                            console.log(`🔍 Criando índice: ${index.name} em ${store.name}`);
                            objectStore.createIndex(index.name, index.keyPath, index.options);
                        });
                    }
                } else {
                    console.log(`✅ Tabela já existe: ${store.name}`);
                }
            });
        };

        request.onsuccess = () => {
            const db = request.result;
            if (epoch !== connectionEpoch) {
                db.close();
                reject(new DOMException("Conexão do banco fechada", "AbortError"));
                return;
            }
            console.log(`✅ Banco de dados aberto com sucesso`);
            dbInstance = db;
            dbInstance.onversionchange = () => {
                dbInstance?.close();
                dbInstance = null;
                dbPromise = null;
            };

            // Clear promise cache after successful connection
            dbPromise = null;

            resolve(db);
        };

        request.onerror = () => {
            if (epoch !== connectionEpoch) {
                reject(request.error);
                return;
            }
            console.error(`❌ Erro ao abrir banco de dados:`, request.error);

            // Clear caches on error
            dbPromise = null;
            dbInstance = null;

            reject(request.error);
        };

        request.onblocked = () => {
            console.warn(`⚠️ Banco de dados bloqueado - fechando outras abas pode resolver`);
        };
    });

    return dbPromise;
}

/** Fecha a conexão em cache. Não apaga dados. */
export function closeDb(): void {
    connectionEpoch += 1;
    if (dbInstance) {
        dbInstance.close();
        dbInstance = null;
    }
    dbPromise = null;
}

/**
 * closeDb() e, se um open ainda estava em voo, espera ele fechar.
 * Não apaga registros.
 */
export async function releaseLocalDatabase(): Promise<void> {
    const pending = dbPromise;
    closeDb();
    if (!pending) return;
    await pending.then(
        () => undefined,
        () => undefined,
    );
}

// Função utilitária para limpar o banco em caso de problemas de versão
export async function clearDatabase(): Promise<void> {
    console.log(`🧹 Limpando banco de dados: ${DATABASE_NAME}`);
    await releaseLocalDatabase();

    return new Promise<void>((resolve, reject) => {
        const deleteRequest = indexedDB.deleteDatabase(DATABASE_NAME);

        deleteRequest.onsuccess = () => {
            console.log(`✅ Banco de dados limpo com sucesso`);
            resolve();
        };

        deleteRequest.onerror = () => {
            console.error(`❌ Erro ao limpar banco de dados:`, deleteRequest.error);
            reject(deleteRequest.error);
        };

        deleteRequest.onblocked = () => {
            console.warn(`⚠️ Limpeza do banco bloqueada - fechando outras abas pode resolver`);
        };
    });
}
