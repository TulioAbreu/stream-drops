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

            try {
                const index = store.index("username");
                const req = index.get(username);

                req.onsuccess = () => {
                    if (req.result) {
                        const deleteReq = store.delete(req.result.twitchUserId);
                        deleteReq.onsuccess = () => resolve();
                        deleteReq.onerror = () => reject(deleteReq.error);
                    } else {
                        reject(new Error(`Exclusion with username ${username} not found`));
                    }
                };
                req.onerror = () => reject(req.error);
            } catch {
                // Fallback: search through all records if index doesn't exist
                const getAllReq = store.getAll();
                getAllReq.onsuccess = () => {
                    const allRecords = getAllReq.result;
                    const record = allRecords.find(r => r.username === username);
                    if (record) {
                        const deleteReq = store.delete(record.twitchUserId);
                        deleteReq.onsuccess = () => resolve();
                        deleteReq.onerror = () => reject(deleteReq.error);
                    } else {
                        reject(new Error(`Exclusion with username ${username} not found`));
                    }
                };
                getAllReq.onerror = () => reject(getAllReq.error);
            }
        });
    };

    return {
        addExclusion,
        getExclusions,
        deleteExclusionByUsername,
    };
}
