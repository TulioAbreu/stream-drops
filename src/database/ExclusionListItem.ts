import { openDb } from ".";

export interface ExclusionListItem {
    twitchUserId: string;
    username: string;
    displayName: string;
    profileImageUrl: string;
    updatedAt: string;
}

const STORE_NAME = "exclusion-list";

export function useExclusionListDb() {
    // CREATE
    const addExclusion = async (user: ExclusionListItem) => {
        const db = await openDb();
        return new Promise<void>((resolve, reject) => {
            const tx = db.transaction(STORE_NAME, "readwrite");
            tx.objectStore(STORE_NAME).add(user);
            tx.oncomplete = () => resolve();
            tx.onerror = () => reject(tx.error);
        });
    };

    // READ ALL
    const getExclusions = async (): Promise<ExclusionListItem[]> => {
        const db = await openDb();
        return new Promise((resolve, reject) => {
            const tx = db.transaction(STORE_NAME, "readonly");
            const req = tx.objectStore(STORE_NAME).getAll();
            req.onsuccess = () => resolve(req.result);
            req.onerror = () => reject(req.error);
        });
    };

    // DELETE
    const deleteExclusionByUsername = async (username: string) => {
        const db = await openDb();
        return new Promise<void>((resolve, reject) => {
            const tx = db.transaction(STORE_NAME, "readwrite");
            const store = tx.objectStore(STORE_NAME);
            const index = store.index("username");
            const req = index.get(username);
            req.onsuccess = () => {
                if (req.result) {
                    store.delete(req.result.twitchUserId);
                    tx.oncomplete = () => resolve();
                } else {
                    reject(new Error(`Exclusion with username ${username} not found`));
                }
            };
            req.onerror = () => reject(req.error);
        });
    };

    return {
        addExclusion,
        getExclusions,
        deleteExclusionByUsername,
    };
}
