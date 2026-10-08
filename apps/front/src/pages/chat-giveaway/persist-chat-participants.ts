import {
  addChatParticipantRows,
  toChatParticipantRecord,
  type ChatParticipantRecord,
} from "@/database/chat-participants";
import { canCollectChatParticipant } from "./hooks/use-chat-listener/guards";
import type { ChatParticipant } from "./types";

export interface ChatParticipantPersistContext {
  excludedUserIds: ReadonlySet<string>;
  broadcasterId?: string;
  channel?: string;
}

export interface ChatParticipantPersistScheduler {
  /** Enfileira elegíveis recém-enriquecidos. Quem já entrou nesta sessão não substitui o `joinedAt`. */
  note(participants: readonly ChatParticipant[]): void;
  /** Grava na hora o que ainda está pendente. Não rejeita. */
  flush(): Promise<void>;
}

type WriteOutcome = "wrote" | "empty" | "retry" | "deferred";

/**
 * No máximo uma transação automática por intervalo, e só se houver gente nova.
 * O flush (sortear, pagehide, unmount) não espera o intervalo.
 * Falha de cota não reagenda sozinha: o próximo lote ou flush tenta de novo.
 */
export function createChatParticipantPersistScheduler(options: {
  getGiveawayId: () => string | undefined;
  getContext: () => ChatParticipantPersistContext;
  intervalMs: () => number;
}): ChatParticipantPersistScheduler {
  const pending = new Map<string, ChatParticipant>();
  const durable = new Set<string>();
  let timer: number | null = null;
  let chain: Promise<void> = Promise.resolve();
  let lastStartedAt = 0;

  const interval = () => {
    const value = options.intervalMs();
    return Number.isFinite(value) && value > 0 ? value : 0;
  };

  const locked = <T>(task: () => Promise<T>): Promise<T> => {
    const run = chain.then(task);
    chain = run.then(
      () => undefined,
      () => undefined,
    );
    return run;
  };

  const rowsToWrite = (): ChatParticipantRecord[] => {
    const giveawayId = options.getGiveawayId();
    if (!giveawayId) return [];

    const context = options.getContext();
    const rows: ChatParticipantRecord[] = [];

    for (const [userId, participant] of pending) {
      if (durable.has(userId)) {
        pending.delete(userId);
        continue;
      }

      const record = toChatParticipantRecord(giveawayId, participant);
      if (!record) {
        pending.delete(userId);
        continue;
      }

      const stillEligible = canCollectChatParticipant(
        { userId: participant.id, userName: participant.name },
        context,
      );
      if (!stillEligible) {
        continue;
      }

      rows.push(record);
    }

    return rows;
  };

  const writeOnce = async (force: boolean): Promise<WriteOutcome> => {
    if (!force) {
      const wait = interval() - (Date.now() - lastStartedAt);
      if (wait > 0) return "deferred";
    }

    const rows = rowsToWrite();
    if (rows.length === 0) return "empty";

    lastStartedAt = Date.now();
    try {
      const outcome = await addChatParticipantRows(rows);
      if (outcome.retry) return "retry";
      for (const userId of outcome.durableUserIds) {
        durable.add(userId);
        pending.delete(userId);
      }
      return "wrote";
    } catch (error) {
      console.warn(
        "Não foi possível gravar participações do chat. O lote será tentado de novo.",
        error,
      );
      return "retry";
    }
  };

  const scheduleAuto = () => {
    if (timer != null) return;
    const wait = Math.max(0, interval() - (Date.now() - lastStartedAt));
    timer = window.setTimeout(() => {
      timer = null;
      void runAuto();
    }, wait);
  };

  const runAuto = async () => {
    const outcome = await locked(() => writeOnce(false));
    if (outcome === "retry" || outcome === "empty") return;
    if (outcome === "deferred" || rowsToWrite().length > 0) {
      scheduleAuto();
    }
  };

  return {
    note(participants) {
      let added = false;
      for (const participant of participants) {
        const userId = participant?.id;
        if (!userId || durable.has(userId) || pending.has(userId)) continue;
        pending.set(userId, { ...participant });
        added = true;
      }
      if (added) scheduleAuto();
    },
    flush() {
      if (timer != null) {
        window.clearTimeout(timer);
        timer = null;
      }
      return locked(async () => {
        await writeOnce(true);
      });
    },
  };
}
