import { openDb } from ".";
import type { ChatGiveawayFormData } from "./ChatGiveaway";

export interface ChatGiveawayTemplate {
    id: string;
    name: string; // Template name
    settings: Omit<ChatGiveawayFormData, "id" | "winners" | "participants" | "createdAt" | "updatedAt">;
    createdAt: string;
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

    // READ ALL
    const getTemplates = async (): Promise<ChatGiveawayTemplate[]> => {
        const db = await openDb();
        return new Promise((resolve, reject) => {
            const tx = db.transaction(STORE_NAME, "readonly");
            const req = tx.objectStore(STORE_NAME).getAll();
            req.onsuccess = () => resolve(req.result);
            req.onerror = () => reject(req.error);
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
        deleteTemplate,
    };
}
