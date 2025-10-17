const DATABASE_NAME = "stream-drops-db";
const DATABASE_VERSION = 6;

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
    }
];

export function openDb(): Promise<IDBDatabase> {
    return new Promise<IDBDatabase>((resolve, reject) => {
        const request = indexedDB.open(DATABASE_NAME, DATABASE_VERSION);

        request.onupgradeneeded = () => {
            const db = request.result;

            stores.forEach(store => {
                if (!db.objectStoreNames.contains(store.name)) {
                    const objectStore = db.createObjectStore(store.name, store.primaryKey.options);

                    // Create indexes if they exist
                    if (store.indexes) {
                        store.indexes.forEach(index => {
                            objectStore.createIndex(index.name, index.keyPath, index.options);
                        });
                    }
                }
            });
        };

        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
    });
}
