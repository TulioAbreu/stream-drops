const DATABASE_NAME = "stream-drops-db";
const DATABASE_VERSION = 7;

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

const stores: DatabaseTable[] = [
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
    }
];

export function openDb(): Promise<IDBDatabase> {
    return new Promise<IDBDatabase>((resolve, reject) => {
        console.log(`🗄️ Abrindo banco de dados: ${DATABASE_NAME} v${DATABASE_VERSION}`);
        const request = indexedDB.open(DATABASE_NAME, DATABASE_VERSION);

        request.onupgradeneeded = () => {
            console.log(`🔧 Atualizando banco de dados para versão ${DATABASE_VERSION}`);
            const db = request.result;

            stores.forEach(store => {
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
            console.log(`✅ Banco de dados aberto com sucesso`);
            resolve(request.result);
        };
        
        request.onerror = () => {
            console.error(`❌ Erro ao abrir banco de dados:`, request.error);
            reject(request.error);
        };
        
        request.onblocked = () => {
            console.warn(`⚠️ Banco de dados bloqueado - fechando outras abas pode resolver`);
        };
    });
}

// Função utilitária para limpar o banco em caso de problemas de versão
export function clearDatabase(): Promise<void> {
    return new Promise<void>((resolve, reject) => {
        console.log(`🧹 Limpando banco de dados: ${DATABASE_NAME}`);
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
