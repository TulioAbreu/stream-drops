import { openDb } from ".";
import type { ChatGiveawayFormData } from "./ChatGiveaway";

export interface ChatGiveawayTemplate {
    id: string;
    name: string; // Template name
    settings: Omit<ChatGiveawayFormData, "id" | "winners" | "participants" | "createdAt" | "updatedAt">;
    createdAt: string;
    sortOrder: number;
}

const STORE_NAME = "chat-giveaway-templates";

export function useChatGiveawayTemplateDb() {
    // CREATE
    const addTemplate = async (data: ChatGiveawayTemplate) => {
        const db = await openDb();
        return new Promise<void>((resolve, reject) => {
            const tx = db.transaction(STORE_NAME, "readwrite");
            tx.objectStore(STORE_NAME).add(data);
            tx.oncomplete = () => resolve();
            tx.onerror = () => reject(tx.error);
        });
    };

    // READ ALL (sorted by sortOrder, with lazy backfill for legacy records)
    const getTemplates = async (): Promise<ChatGiveawayTemplate[]> => {
        const db = await openDb();
        return new Promise((resolve, reject) => {
            const tx = db.transaction(STORE_NAME, "readwrite");
            const store = tx.objectStore(STORE_NAME);
            const req = store.getAll();

            req.onsuccess = () => {
                const raw = req.result as ChatGiveawayTemplate[];
                const needsBackfill = raw.some((t) => typeof t.sortOrder !== "number");

                // Preserve IndexedDB insertion order for legacy records without sortOrder
                const withOrder = raw.map((t, index) =>
                    typeof t.sortOrder === "number" ? t : { ...t, sortOrder: index },
                );
                withOrder.sort((a, b) => a.sortOrder - b.sortOrder);
                const normalized = withOrder.map((t, index) => ({ ...t, sortOrder: index }));

                if (needsBackfill) {
                    for (const template of normalized) {
                        store.put(template);
                    }
                }

                resolve(normalized);
            };
            req.onerror = () => reject(req.error);
        });
    };

    // UPDATE ORDER
    const updateTemplatesOrder = async (orderedIds: string[]) => {
        const db = await openDb();
        return new Promise<void>((resolve, reject) => {
            const tx = db.transaction(STORE_NAME, "readwrite");
            const store = tx.objectStore(STORE_NAME);

            orderedIds.forEach((id, index) => {
                const getReq = store.get(id);
                getReq.onsuccess = () => {
                    const template = getReq.result as ChatGiveawayTemplate | undefined;
                    if (template) {
                        store.put({ ...template, sortOrder: index });
                    }
                };
                getReq.onerror = () => reject(getReq.error);
            });

            tx.oncomplete = () => resolve();
            tx.onerror = () => reject(tx.error);
        });
    };

    // DELETE
    const deleteTemplate = async (id: string) => {
        const db = await openDb();
        return new Promise<void>((resolve, reject) => {
            const tx = db.transaction(STORE_NAME, "readwrite");
            tx.objectStore(STORE_NAME).delete(id);
            tx.oncomplete = () => resolve();
            tx.onerror = () => reject(tx.error);
        });
    };

    return {
        addTemplate,
        getTemplates,
        updateTemplatesOrder,
        deleteTemplate,
    };
}
