import type {
  ChannelPointsGiveawayFormData,
  ChannelPointsParticipant,
} from "./ChannelPointsGiveaway";
import type {
  ChatGiveawayFormData,
  ChatGiveawayWinner,
  ChatGiveawayWinnerContext,
} from "./ChatGiveaway";
import { CHAT_PARTICIPANTS_STORE } from "./chat-participants";
import type { FollowerGiveawayFormData } from "./SubscriptionGiveaway";
import { noteGiveawayHardDeleted, noteGiveawaySoftDeleted } from "@/lib/winner-badges/readiness";
import { openDb } from ".";

/**
 * Soft-delete na v12, sem bump.
 * `deletedAt` ausente ou vazio = sorteio ativo.
 * `participation.v` fica em 1 para a leitura tolerante futura.
 */

/** O update recusou gravar porque o sorteio já está soft-deleted. */
export type GiveawayWriteResult = "saved" | "deleted";

export type ParticipationUser =
  | [userId: string, displayName: string, at: number]
  | [userId: string, displayName: string, at: number, tickets: number];

export interface GiveawayParticipation {
  v: 1;
  users: ParticipationUser[];
}

const CHAT_STORE = "chat-giveaways";
const POINTS_STORE = "channel-points-giveaways";
const SUBSCRIBER_STORE = "giveaways";
const TIERS = new Set([1000, 2000, 3000]);

type ChatPerson = {
  id?: string;
  userId?: string;
  displayName?: string;
  name?: string;
  joinedAt?: number;
  subscriptionMonths?: number;
  tier?: number | string | null;
};

type PersonAccum = {
  displayName: string;
  atMs?: number;
  fromRecord: boolean;
  months?: number;
  tier?: 1000 | 2000 | 3000;
};

export function isDeletedGiveaway(record: unknown): boolean {
  if (!record || typeof record !== "object") return false;
  const deletedAt = (record as { deletedAt?: unknown }).deletedAt;
  return typeof deletedAt === "string" && deletedAt.length > 0;
}

function deletedAtStamp(now?: string): string {
  if (typeof now === "string" && now.length > 0) return now;
  return new Date().toISOString();
}

function readMonths(value: unknown): number | undefined {
  if (typeof value !== "number" || !Number.isFinite(value)) return undefined;
  return value;
}

function readTier(value: unknown): 1000 | 2000 | 3000 | undefined {
  const numeric = typeof value === "string" ? Number(value) : value;
  if (typeof numeric === "number" && TIERS.has(numeric)) {
    return numeric as 1000 | 2000 | 3000;
  }
  return undefined;
}

function userIdOf(person: ChatPerson, prefer: "id" | "userId"): string {
  const raw = prefer === "id" ? person.id : person.userId;
  return typeof raw === "string" ? raw.trim() : "";
}

function touchAt(entry: PersonAccum, joinedAt: unknown) {
  if (typeof joinedAt !== "number" || !Number.isFinite(joinedAt)) return;
  if (entry.atMs === undefined || joinedAt < entry.atMs) {
    entry.atMs = joinedAt;
  }
}

function blankPerson(): PersonAccum {
  return { displayName: "", fromRecord: false };
}

function applyRecord(entry: PersonAccum, person: ChatPerson) {
  entry.fromRecord = true;
  if (typeof person.displayName === "string") {
    entry.displayName = person.displayName;
  } else if (!entry.displayName && typeof person.name === "string") {
    entry.displayName = person.name;
  }
  const months = readMonths(person.subscriptionMonths);
  const tier = readTier(person.tier);
  if (months !== undefined) entry.months = months;
  if (tier !== undefined) entry.tier = tier;
}

function applyRow(entry: PersonAccum, person: ChatPerson) {
  if (!entry.fromRecord && !entry.displayName) {
    if (typeof person.displayName === "string") {
      entry.displayName = person.displayName;
    } else if (typeof person.name === "string") {
      entry.displayName = person.name;
    }
  }
  if (entry.months === undefined) {
    const months = readMonths(person.subscriptionMonths);
    if (months !== undefined) entry.months = months;
  }
  if (entry.tier === undefined) {
    const tier = readTier(person.tier);
    if (tier !== undefined) entry.tier = tier;
  }
}

function epochSeconds(ms: number | undefined, fallback: number): number {
  if (ms === undefined || !Number.isFinite(ms)) return fallback;
  return Math.floor(ms / 1000);
}

function secondsFromIso(value: string | undefined): number | undefined {
  if (!value) return undefined;
  const ms = Date.parse(value);
  if (!Number.isFinite(ms)) return undefined;
  return Math.floor(ms / 1000);
}

function collectChat(
  participants: readonly ChatPerson[] | undefined,
  rows: readonly ChatPerson[],
  createdAt: string | undefined,
): { participation: GiveawayParticipation; contextByUser: Map<string, ChatGiveawayWinnerContext> } {
  const people = new Map<string, PersonAccum>();
  const order: string[] = [];

  const ensure = (userId: string) => {
    let entry = people.get(userId);
    if (!entry) {
      entry = blankPerson();
      people.set(userId, entry);
      order.push(userId);
    }
    return entry;
  };

  for (const person of participants ?? []) {
    const userId = userIdOf(person, "id");
    if (!userId) continue;
    const entry = ensure(userId);
    touchAt(entry, person.joinedAt);
    applyRecord(entry, person);
  }

  for (const row of rows) {
    const userId = userIdOf(row, "userId");
    if (!userId) continue;
    const entry = ensure(userId);
    touchAt(entry, row.joinedAt);
    applyRow(entry, row);
  }

  const fallback = secondsFromIso(createdAt) ?? 0;
  const contextByUser = new Map<string, ChatGiveawayWinnerContext>();
  const users: ParticipationUser[] = order.map((userId) => {
    const entry = people.get(userId) ?? blankPerson();
    const context: ChatGiveawayWinnerContext = {};
    if (entry.months !== undefined) context.subscriptionMonths = entry.months;
    if (entry.tier !== undefined) context.tier = entry.tier;
    if (
      context.subscriptionMonths !== undefined ||
      context.tier !== undefined
    ) {
      contextByUser.set(userId, context);
    }
    return [userId, entry.displayName, epochSeconds(entry.atMs, fallback)];
  });

  return { participation: { v: 1, users }, contextByUser };
}

function copyWinnerContext(
  winners: readonly ChatGiveawayWinner[],
  contextByUser: Map<string, ChatGiveawayWinnerContext>,
): ChatGiveawayWinner[] {
  return winners.map((winner) => {
    if (winner.context != null) return winner;
    const userId = winner.twitchId?.trim() ?? "";
    const context = userId ? contextByUser.get(userId) : undefined;
    if (!context) return winner;
    return { ...winner, context };
  });
}

export function pruneChatGiveaway(
  record: ChatGiveawayFormData,
  rows: readonly ChatPerson[],
  deletedAt: string,
): ChatGiveawayFormData {
  const { participation, contextByUser } = collectChat(
    record.participants,
    rows,
    record.createdAt,
  );
  const { winners, ...rest } = record;
  const next = {
    ...rest,
    deletedAt,
    participants: [],
    participation,
  } as unknown as ChatGiveawayFormData;
  if (Array.isArray(winners)) {
    next.winners = copyWinnerContext(winners, contextByUser);
  } else {
    delete (next as { winners?: ChatGiveawayFormData["winners"] }).winners;
  }
  return next;
}

function pointsDisplayName(person: ChannelPointsParticipant): string {
  if (typeof person.displayName === "string") return person.displayName;
  return person.name ?? "";
}

export function pruneChannelPointsGiveaway(
  record: ChannelPointsGiveawayFormData,
  deletedAt: string,
): ChannelPointsGiveawayFormData {
  const fallback = secondsFromIso(record.createdAt) ?? 0;
  const people = new Map<string, ParticipationUser>();
  const order: string[] = [];

  for (const person of record.participants ?? []) {
    const userId = person.userId?.trim() ?? "";
    if (!userId) continue;
    const ticketTimes = (person.tickets ?? [])
      .map((ticket) => secondsFromIso(ticket.redeemedAt))
      .filter((value): value is number => value !== undefined);
    const at = ticketTimes.length > 0 ? Math.min(...ticketTimes) : fallback;
    const tickets = person.tickets?.length ?? 0;
    const current = people.get(userId);
    if (!current) {
      people.set(userId, [userId, pointsDisplayName(person), at, tickets]);
      order.push(userId);
      continue;
    }
    const nextAt = Math.min(current[2], at);
    const nextTickets = (current[3] ?? 0) + tickets;
    people.set(userId, [userId, current[1], nextAt, nextTickets]);
  }

  const { winners, collectionProgress: _collectionProgress, ...rest } = record;
  const next = {
    ...rest,
    deletedAt,
    participants: [],
    participation: {
      v: 1,
      users: order.map((userId) => people.get(userId) as ParticipationUser),
    },
  } as unknown as ChannelPointsGiveawayFormData;
  if (Array.isArray(winners)) {
    next.winners = winners;
  } else {
    delete (next as { winners?: ChannelPointsGiveawayFormData["winners"] }).winners;
  }
  return next;
}

export function pruneSubscriberGiveaway(
  record: FollowerGiveawayFormData,
  deletedAt: string,
): FollowerGiveawayFormData {
  const { winners, ...rest } = record;
  const next = {
    ...rest,
    deletedAt,
    participants: [],
  } as unknown as FollowerGiveawayFormData;
  if (Array.isArray(winners)) {
    next.winners = winners;
  } else {
    delete (next as { winners?: FollowerGiveawayFormData["winners"] }).winners;
  }
  return next;
}

function settle<T>(
  resolve: (value: T) => void,
  reject: (reason?: unknown) => void,
  tx: IDBTransaction,
  done: () => T,
) {
  let settled = false;
  const finish = (error?: unknown) => {
    if (settled) return;
    settled = true;
    if (error) reject(error);
    else resolve(done());
  };
  tx.oncomplete = () => finish();
  tx.onerror = () => finish(tx.error ?? new Error("Falha na transação"));
  tx.onabort = () => finish(tx.error ?? new Error("Transação abortada"));
}

function noteSoft(type: "chat" | "channel-points" | "subscribers", record: unknown) {
  try {
    noteGiveawaySoftDeleted(type, record);
  } catch (error) {
    console.error(error);
  }
}

function noteHard(type: "chat" | "channel-points" | "subscribers", id: string) {
  try {
    noteGiveawayHardDeleted(type, id);
  } catch (error) {
    console.error(error);
  }
}

function chatRowStore(tx: IDBTransaction): IDBObjectStore | null {
  if (!tx.objectStoreNames.contains(CHAT_PARTICIPANTS_STORE)) return null;
  return tx.objectStore(CHAT_PARTICIPANTS_STORE);
}

function deleteChatRows(store: IDBObjectStore | null, rows: readonly ChatPerson[]) {
  if (!store) return;
  for (const row of rows) {
    if (typeof row.id === "string" && row.id.length > 0) {
      store.delete(row.id);
    }
  }
}

/**
 * O próximo request sai no mesmo turno do `onsuccess`.
 * Uma Promise no meio deixaria a transação commitar antes do `put`.
 */
function withChatRows(
  tx: IDBTransaction,
  giveawayId: string,
  apply: (rows: ChatPerson[], store: IDBObjectStore | null) => void,
) {
  const store = chatRowStore(tx);
  if (!store) {
    apply([], null);
    return;
  }
  let index: IDBIndex;
  try {
    index = store.index("giveawayId");
  } catch {
    apply([], store);
    return;
  }
  const request = index.getAll(giveawayId);
  request.onsuccess = () => {
    const rows = Array.isArray(request.result)
      ? request.result as ChatPerson[]
      : [];
    apply(rows, store);
  };
}

export async function softDeleteChatGiveaway(
  id: string,
  now?: string,
): Promise<ChatGiveawayFormData | undefined> {
  if (!id) return undefined;
  const deletedAt = deletedAtStamp(now);
  const db = await openDb();
  const names = [CHAT_STORE];
  if (db.objectStoreNames.contains(CHAT_PARTICIPANTS_STORE)) {
    names.push(CHAT_PARTICIPANTS_STORE);
  }

  return new Promise((resolve, reject) => {
    const tx = db.transaction(names, "readwrite");
    let pruned: ChatGiveawayFormData | undefined;
    const giveaways = tx.objectStore(CHAT_STORE);
    const request = giveaways.get(id);
    request.onsuccess = () => {
      const current = request.result as ChatGiveawayFormData | undefined;
      if (!current || isDeletedGiveaway(current)) return;
      withChatRows(tx, id, (rows) => {
        pruned = pruneChatGiveaway(current, rows, deletedAt);
        giveaways.put(pruned);
        deleteChatRows(chatRowStore(tx), rows);
      });
    };
    settle(resolve, reject, tx, () => {
      if (pruned) noteSoft("chat", pruned);
      return pruned;
    });
  });
}

export async function hardDeleteChatGiveaway(id: string): Promise<void> {
  if (!id) return;
  const db = await openDb();
  const names = [CHAT_STORE];
  if (db.objectStoreNames.contains(CHAT_PARTICIPANTS_STORE)) {
    names.push(CHAT_PARTICIPANTS_STORE);
  }

  return new Promise((resolve, reject) => {
    const tx = db.transaction(names, "readwrite");
    tx.objectStore(CHAT_STORE).delete(id);
    withChatRows(tx, id, (rows, store) => {
      deleteChatRows(store, rows);
    });
    settle(resolve, reject, tx, () => {
      noteHard("chat", id);
      return undefined;
    });
  });
}

export async function softDeleteChannelPointsGiveaway(
  id: string,
  now?: string,
): Promise<ChannelPointsGiveawayFormData | undefined> {
  if (!id) return undefined;
  const deletedAt = deletedAtStamp(now);
  const db = await openDb();

  return new Promise((resolve, reject) => {
    const tx = db.transaction(POINTS_STORE, "readwrite");
    let pruned: ChannelPointsGiveawayFormData | undefined;
    const store = tx.objectStore(POINTS_STORE);
    const request = store.get(id);
    request.onsuccess = () => {
      const current = request.result as ChannelPointsGiveawayFormData | undefined;
      if (!current || isDeletedGiveaway(current)) return;
      pruned = pruneChannelPointsGiveaway(current, deletedAt);
      store.put(pruned);
    };
    settle(resolve, reject, tx, () => {
      if (pruned) noteSoft("channel-points", pruned);
      return pruned;
    });
  });
}

export async function hardDeleteChannelPointsGiveaway(id: string): Promise<void> {
  if (!id) return;
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(POINTS_STORE, "readwrite");
    tx.objectStore(POINTS_STORE).delete(id);
    settle(resolve, reject, tx, () => {
      noteHard("channel-points", id);
      return undefined;
    });
  });
}

export async function softDeleteSubscriberGiveaway(
  id: string,
  now?: string,
): Promise<FollowerGiveawayFormData | undefined> {
  if (!id) return undefined;
  const deletedAt = deletedAtStamp(now);
  const db = await openDb();

  return new Promise((resolve, reject) => {
    const tx = db.transaction(SUBSCRIBER_STORE, "readwrite");
    let pruned: FollowerGiveawayFormData | undefined;
    const store = tx.objectStore(SUBSCRIBER_STORE);
    const request = store.get(id);
    request.onsuccess = () => {
      const current = request.result as FollowerGiveawayFormData | undefined;
      if (!current || isDeletedGiveaway(current)) return;
      pruned = pruneSubscriberGiveaway(current, deletedAt);
      store.put(pruned);
    };
    settle(resolve, reject, tx, () => {
      if (pruned) noteSoft("subscribers", pruned);
      return pruned;
    });
  });
}

export async function hardDeleteSubscriberGiveaway(id: string): Promise<void> {
  if (!id) return;
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(SUBSCRIBER_STORE, "readwrite");
    tx.objectStore(SUBSCRIBER_STORE).delete(id);
    settle(resolve, reject, tx, () => {
      noteHard("subscribers", id);
      return undefined;
    });
  });
}
