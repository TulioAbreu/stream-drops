const DATABASE_NAME = "stream-drops-db";
const DATABASE_VERSION = 3;

interface DatabaseTable {
    name: string;
    index: {
        keyPath: string;
        options?: IDBIndexParameters;
    }
}

const stores: DatabaseTable[] = [
    {
        name: "exclusion-list",
        index: {
            keyPath: "twitchUserId",
            options: { unique: true }
        }
    },
    {
        name: "giveaways",
        index: {
            keyPath: "id",
            options: { unique: true }
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
                    const objectStore = db.createObjectStore(store.name, { keyPath: store.index.keyPath });
                    if (store.index.options) {
                        objectStore.createIndex(store.index.keyPath, store.index.keyPath, store.index.options);
                    }
                }
            });
        };

        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
    });
}
