import type { ChatParticipant } from "./types";

export function sameStringSet(
  left: ReadonlySet<string>,
  right: ReadonlySet<string>,
): boolean {
  if (left.size !== right.size) {
    return false;
  }
  for (const value of left) {
    if (!right.has(value)) {
      return false;
    }
  }
  return true;
}

/**
 * União por id. Quem já estava salvo permanece, mesmo excluído hoje.
 * Quem está nos dois fica com os dados ao vivo (avatar e tier mais novos).
 */
export function unionChatParticipants(
  saved: readonly ChatParticipant[],
  live: readonly ChatParticipant[],
): ChatParticipant[] {
  const byId = new Map<string, ChatParticipant>();
  for (const participant of saved) {
    byId.set(participant.id, participant);
  }
  for (const participant of live) {
    byId.set(participant.id, participant);
  }
  return [...byId.values()];
}

export function selectEligibleChatParticipants(
  participants: readonly ChatParticipant[],
  options: {
    excludedUserIds: Iterable<string>;
    broadcasterId?: string | null;
  },
): ChatParticipant[] {
  const excluded =
    options.excludedUserIds instanceof Set
      ? options.excludedUserIds
      : new Set(options.excludedUserIds);

  return participants.filter((participant) => {
    if (options.broadcasterId && participant.id === options.broadcasterId) {
      return false;
    }
    return !excluded.has(participant.id);
  });
}

export function filterChatParticipantsByName(
  participants: readonly ChatParticipant[],
  nameFilter: string,
): ChatParticipant[] {
  const term = nameFilter.trim().toLowerCase();
  if (!term) {
    return [...participants];
  }
  return participants.filter((participant) => {
    return (
      participant.name.toLowerCase().includes(term) ||
      participant.displayName.toLowerCase().includes(term)
    );
  });
}

export interface ChatGiveawayPools {
  /** União salva + ao vivo. É o que a confirmação grava. */
  persisted: ChatParticipant[];
  /** Sorteáveis: união menos exclusão e broadcaster. */
  eligible: ChatParticipant[];
  /** Só exibição. */
  displayed: ChatParticipant[];
}

export function buildChatGiveawayPools(input: {
  saved: readonly ChatParticipant[];
  live: readonly ChatParticipant[];
  excludedUserIds: Iterable<string>;
  broadcasterId?: string | null;
  nameFilter: string;
}): ChatGiveawayPools {
  const persisted = unionChatParticipants(input.saved, input.live);
  const eligible = selectEligibleChatParticipants(persisted, {
    excludedUserIds: input.excludedUserIds,
    broadcasterId: input.broadcasterId,
  });
  const displayed = filterChatParticipantsByName(eligible, input.nameFilter);
  return { persisted, eligible, displayed };
}
