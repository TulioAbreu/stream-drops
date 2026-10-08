import type { ChatParticipant } from "@/pages/chat-giveaway/types";
import { openDb } from ".";

/** Store já criado no upgrade da v12. Esta fatia não aumenta a versão. */
export const CHAT_PARTICIPANTS_STORE = "chat-participants";

export interface ChatParticipantRecord {
  id: string;
  giveawayId: string;
  userId: string;
  name: string;
  displayName: string;
  avatar: string;
  subscriber: boolean;
  subscriptionMonths?: number;
  tier?: 1000 | 2000 | 3000 | null;
  joinedAt: number;
}

export interface AddChatParticipantRowsResult {
  /** Inseridos agora ou já presentes. O primeiro `joinedAt` permanece. */
  durableUserIds: string[];
  /** Cota ou transação falhou: o lote inteiro deve ser tentado de novo. */
  retry: boolean;
}

const WARN_MESSAGE =
  "Não foi possível gravar participações do chat. O lote será tentado de novo.";

export function toChatParticipantRecord(
  giveawayId: string,
  participant: ChatParticipant,
): ChatParticipantRecord | null {
  const userId = participant.id?.trim() ?? "";
  if (!giveawayId || !userId || userId === "unknown") {
    return null;
  }
  if (!Number.isFinite(participant.joinedAt)) {
    return null;
  }

  const record: ChatParticipantRecord = {
    id: `${giveawayId}:${userId}`,
    giveawayId,
    userId,
    name: participant.name,
    displayName: participant.displayName,
    avatar: participant.avatar,
    subscriber: Boolean(participant.subscriber),
    joinedAt: participant.joinedAt,
  };

  if (typeof participant.subscriptionMonths === "number") {
    record.subscriptionMonths = participant.subscriptionMonths;
  }
  if (participant.tier !== undefined) {
    record.tier = participant.tier;
  }

  return record;
}

function hasUserId(value: unknown): value is ChatParticipantRecord {
  if (!value || typeof value !== "object") {
    return false;
  }
  const userId = (value as { userId?: unknown }).userId;
  return typeof userId === "string" && userId.length > 0;
}

/**
 * Lê pelo índice `giveawayId`. Linha antiga sem `userId` é ignorada e não é
 * corrigida no disco. Store ausente devolve lista vazia.
 */
export async function getChatParticipantsByGiveaway(
  giveawayId: string,
): Promise<ChatParticipantRecord[]> {
  const db = await openDb();
  if (!db.objectStoreNames.contains(CHAT_PARTICIPANTS_STORE)) {
    return [];
  }

  return new Promise((resolve, reject) => {
    let tx: IDBTransaction;
    try {
      tx = db.transaction(CHAT_PARTICIPANTS_STORE, "readonly");
    } catch (error) {
      reject(error);
      return;
    }

    let request: IDBRequest;
    try {
      request = tx.objectStore(CHAT_PARTICIPANTS_STORE).index("giveawayId").getAll(giveawayId);
    } catch (error) {
      reject(error);
      return;
    }

    request.onsuccess = () => {
      const rows = Array.isArray(request.result) ? request.result : [];
      resolve(rows.filter(hasUserId));
    };
    request.onerror = () => reject(request.error);
  });
}

/**
 * Insere só linhas novas, numa transação `readwrite` exclusiva de
 * `chat-participants`. `add` não reescreve: `ConstraintError` preserva o
 * primeiro `joinedAt`. Não cria store e não toca no registro do sorteio.
 */
export async function addChatParticipantRows(
  rows: readonly ChatParticipantRecord[],
): Promise<AddChatParticipantRowsResult> {
  if (rows.length === 0) {
    return { durableUserIds: [], retry: false };
  }

  let db: IDBDatabase;
  try {
    db = await openDb();
  } catch (error) {
    console.warn(WARN_MESSAGE, error);
    return { durableUserIds: [], retry: true };
  }

  if (!db.objectStoreNames.contains(CHAT_PARTICIPANTS_STORE)) {
    return { durableUserIds: [], retry: false };
  }

  return new Promise((resolve) => {
    let tx: IDBTransaction;
    try {
      tx = db.transaction(CHAT_PARTICIPANTS_STORE, "readwrite");
    } catch (error) {
      console.warn(WARN_MESSAGE, error);
      resolve({ durableUserIds: [], retry: true });
      return;
    }

    const store = tx.objectStore(CHAT_PARTICIPANTS_STORE);
    const durableUserIds: string[] = [];
    let settled = false;
    let warned = false;

    const finish = (retry: boolean) => {
      if (settled) return;
      settled = true;
      resolve({
        durableUserIds: retry ? [] : durableUserIds,
        retry,
      });
    };

    const warn = (error: unknown) => {
      if (warned) return;
      warned = true;
      console.warn(WARN_MESSAGE, error);
    };

    try {
      for (const row of rows) {
        const request = store.add(row);
        request.onsuccess = () => {
          durableUserIds.push(row.userId);
        };
        request.onerror = (event) => {
          const error = request.error;
          if (error?.name === "ConstraintError") {
            event.preventDefault();
            event.stopPropagation();
            durableUserIds.push(row.userId);
            return;
          }
          warn(error);
        };
      }
    } catch (error) {
      warn(error);
      try {
        tx.abort();
      } catch {
        // A transação já estava encerrada.
      }
      finish(true);
      return;
    }

    tx.oncomplete = () => finish(false);
    tx.onabort = () => {
      warn(tx.error);
      finish(true);
    };
    tx.onerror = (event) => {
      if (tx.error?.name === "ConstraintError") {
        event.preventDefault();
        return;
      }
      warn(tx.error);
    };
  });
}
