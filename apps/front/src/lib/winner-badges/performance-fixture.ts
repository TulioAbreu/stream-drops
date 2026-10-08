/**
 * Fixture do gate de performance (doc de selos §6).
 *
 * A Dashboard reutiliza este gerador nos gates M3 e M4
 * (`proposta-dashboard-inicial.md` §5): mesmos 1.000 sorteios,
 * ~50 pessoas, 10.000 vitórias, 2.000 viewers, soft-delete com
 * resumo `participation`, linhas de `chat-participants` nos
 * Chats ativos, sorteios sem vencedor, entradas depois do
 * último `drawnAt` e Subscribers com e sem `drawnAt`.
 *
 * Os números exatos ficam em `counts` (o "~60 mil eventos"
 * do doc da Dashboard é estimativa; o gerador não arredonda).
 * Não grava IndexedDB. Quem testa é que faz o `put`.
 */

export const PERFORMANCE_FIXTURE_SCALE = {
  giveaways: 1_000,
  viewers: 2_000,
  wins: 10_000,
  peoplePerGiveaway: 50,
} as const;

export const PERFORMANCE_FIXTURE_STORES = {
  chat: "chat-giveaways",
  channelPoints: "channel-points-giveaways",
  subscribers: "giveaways",
  chatParticipants: "chat-participants",
} as const;

const {
  giveaways: GIVEAWAYS,
  viewers: VIEWERS,
  wins: WINS,
  peoplePerGiveaway: PEOPLE,
} = PERFORMANCE_FIXTURE_SCALE;

const BASE_MS = Date.parse("2026-06-01T15:00:00.000Z");
const STEP_MS = Math.floor((120 * 24 * 60 * 60 * 1000) / WINS);
const DELETED_AT = "2026-10-01T12:00:00.000Z";
const AVATAR =
  "https://static-cdn.jtvnw.net/jtv_user_pictures/stream-drops-winner-avatar-300x300-profile.png";
const TIERS = [1000, 2000, 3000] as const;

export type FixtureTier = (typeof TIERS)[number];

export type FixtureParticipation = {
  v: 1;
  users: Array<
    [string, string, number] | [string, string, number, number]
  >;
};

export type FixtureChatWinner = {
  id: string;
  name: string;
  twitchId: string;
  avatar: string;
  drawnAt: string;
  /** Copiado na poda, como a S4 faz antes de esvaziar `participants`. */
  context?: { subscriptionMonths: number; tier: "1000" | "2000" | "3000" };
};

export type FixtureChatParticipant = {
  id: string;
  name: string;
  displayName: string;
  avatar: string;
  subscriber: boolean;
  subscriptionMonths: number;
  tier: FixtureTier;
  joinedAt: number;
};

export type FixtureChatGiveaway = {
  id: string;
  title: string;
  description: string;
  keyword: string;
  cost: number;
  minimumSuscriptionTimeInMonths: number;
  subscriberMultiplier: number;
  subscribersOnly: boolean;
  winners: FixtureChatWinner[];
  participants: FixtureChatParticipant[];
  createdAt: string;
  updatedAt: string;
  deletedAt?: string;
  participation?: FixtureParticipation;
};

export type FixtureTicket = {
  redemptionId: string;
  redeemedAt: string;
};

export type FixtureChannelPointsParticipant = {
  userId: string;
  name: string;
  displayName: string;
  avatar: string;
  subscriber: boolean;
  tier: FixtureTier;
  tickets: FixtureTicket[];
};

export type FixtureChannelPointsWinner = {
  id: string;
  userId: string;
  name: string;
  avatar: string;
  redemptionId: string;
  drawnAt: string;
};

export type FixtureChannelPointsGiveaway = {
  id: string;
  title: string;
  description: string;
  cost: number;
  rewardId: string;
  rewardEnabled: boolean;
  maxPerStream: null;
  subscribersOnly: boolean;
  subscriptionRequirement: number;
  subscriberMultiplier: Record<"1000" | "2000" | "3000", number>;
  refundIneligible: boolean;
  allowMultipleWins: boolean;
  status: "ready" | "closed";
  participants: FixtureChannelPointsParticipant[];
  winners: FixtureChannelPointsWinner[];
  createdAt: string;
  updatedAt: string;
  deletedAt?: string;
  participation?: FixtureParticipation;
};

export type FixtureSubscriber = {
  broadcaster_id: string;
  broadcaster_login: string;
  broadcaster_name: string;
  gifter_id: string;
  gifter_login: string;
  is_gift: boolean;
  plan_name: string;
  tier: "1000" | "2000" | "3000";
  user_id: string;
  user_name: string;
  user_login: string;
  drawnAt?: string;
};

export type FixtureSubscriberGiveaway = {
  id: string;
  title: string;
  description: string;
  subscriptionRequirement: number;
  subscriberMultiplier: Record<"1000" | "2000" | "3000", number>;
  participants: FixtureSubscriber[];
  winners: FixtureSubscriber[];
  spreadsheetUrl: null;
  createdAt?: string;
  updatedAt?: string;
  deletedAt?: string;
};

export type FixtureChatParticipantRow = {
  id: string;
  giveawayId: string;
  userId: string;
  name: string;
  displayName: string;
  avatar: string;
  subscriber: boolean;
  subscriptionMonths: number;
  tier: FixtureTier;
  joinedAt: number;
};

export type PerformanceFixtureCounts = {
  giveaways: number;
  wins: number;
  distinctWinners: number;
  peoplePerGiveaway: number;
  /** Pessoas em `participants` ou no resumo `participation`. */
  storedPeople: number;
  chatParticipantRows: number;
  softDeleted: number;
  softDeletedWithSummary: number;
  giveawaysWithoutWinners: number;
  undatedSubscriberWins: number;
  datedSubscriberWins: number;
  lateChatEntries: number;
  chat: number;
  channelPoints: number;
  subscribers: number;
};

export type PerformanceFixture = {
  chatGiveaways: FixtureChatGiveaway[];
  channelPointsGiveaways: FixtureChannelPointsGiveaway[];
  subscriberGiveaways: FixtureSubscriberGiveaway[];
  chatParticipants: FixtureChatParticipantRow[];
  counts: PerformanceFixtureCounts;
};

type Kind = "chat" | "cp" | "sub";

type AssignedWin = { user: number; slot: number };

const MULTIPLIER = { "1000": 1, "2000": 2, "3000": 3 } as const;

export function performanceViewerId(index: number): string {
  return `v${String(index).padStart(4, "0")}`;
}

function pad(index: number): string {
  return String(index).padStart(4, "0");
}

function kindOf(index: number): Kind {
  if (index % 3 === 0) return "chat";
  if (index % 3 === 1) return "cp";
  return "sub";
}

function giveawayId(index: number): string {
  const id = pad(index);
  const kind = kindOf(index);
  if (kind === "chat") return `chat-${id}`;
  if (kind === "cp") return `cp-${id}`;
  return `sub-${id}`;
}

function viewerName(index: number): string {
  return `Viewer ${index}`;
}

function viewerLogin(index: number): string {
  return `viewer${index}`;
}

function tierOf(index: number): FixtureTier {
  return TIERS[index % 3] ?? 1000;
}

function tierName(tier: FixtureTier): "1000" | "2000" | "3000" {
  if (tier === 2000) return "2000";
  if (tier === 3000) return "3000";
  return "1000";
}

function tierLabel(index: number): "1000" | "2000" | "3000" {
  return tierName(tierOf(index));
}

function isUndatedSubscriber(index: number): boolean {
  return kindOf(index) === "sub" && Math.floor(index / 3) % 2 === 0;
}

function assignWins(): Map<number, AssignedWin[]> {
  const hosts: number[] = [];
  for (let index = 0; index < GIVEAWAYS; index += 1) {
    if (index % 10 !== 9) hosts.push(index);
  }
  if (hosts.length !== 900) {
    throw new Error(`sorteios com vitória: ${hosts.length}`);
  }
  const assigned = new Map<number, AssignedWin[]>();
  let slot = 0;
  hosts.forEach((giveawayIndex, ordinal) => {
    const count = ordinal < 100 ? 12 : 11;
    const rows: AssignedWin[] = [];
    for (let offset = 0; offset < count; offset += 1) {
      rows.push({ user: slot % VIEWERS, slot });
      slot += 1;
    }
    assigned.set(giveawayIndex, rows);
  });
  if (slot !== WINS) throw new Error(`vitórias geradas: ${slot}`);
  return assigned;
}

function peopleFor(index: number, winners: readonly number[]): number[] {
  const ids: number[] = [];
  const seen = new Set<number>();
  for (const user of winners) {
    if (seen.has(user)) continue;
    seen.add(user);
    ids.push(user);
  }
  let cursor = (index * 13) % VIEWERS;
  let guard = 0;
  while (ids.length < PEOPLE) {
    if (!seen.has(cursor)) {
      seen.add(cursor);
      ids.push(cursor);
    }
    cursor = (cursor + 1) % VIEWERS;
    guard += 1;
    if (guard > VIEWERS + PEOPLE) {
      throw new Error(`participantes do sorteio ${index}`);
    }
  }
  return ids;
}

function ticketsFor(user: number, atMs: number, giveaway: string): FixtureTicket[] {
  const count = user % 17 === 0 ? 3 : 1;
  const tickets: FixtureTicket[] = [];
  for (let offset = 0; offset < count; offset += 1) {
    tickets.push({
      redemptionId: `${giveaway}-${performanceViewerId(user)}-${offset}`,
      redeemedAt: new Date(atMs + offset * 1000).toISOString(),
    });
  }
  return tickets;
}

function subscriberOf(user: number, drawnAt?: string): FixtureSubscriber {
  const gift = user % 5 === 0;
  const record: FixtureSubscriber = {
    broadcaster_id: "broadcaster",
    broadcaster_login: "canal",
    broadcaster_name: "Canal",
    gifter_id: gift ? "gifter" : "",
    gifter_login: gift ? "gifter" : "",
    is_gift: gift,
    plan_name: "Tier",
    tier: tierLabel(user),
    user_id: performanceViewerId(user),
    user_name: viewerName(user),
    user_login: viewerLogin(user),
  };
  if (drawnAt) record.drawnAt = drawnAt;
  return record;
}

function createdIso(index: number): string {
  return new Date(BASE_MS - 86_400_000 + index * 60_000).toISOString();
}

export function performanceFixtureRecords(fixture: PerformanceFixture): {
  "chat-giveaways": FixtureChatGiveaway[];
  "channel-points-giveaways": FixtureChannelPointsGiveaway[];
  giveaways: FixtureSubscriberGiveaway[];
  "chat-participants": FixtureChatParticipantRow[];
} {
  return {
    "chat-giveaways": fixture.chatGiveaways,
    "channel-points-giveaways": fixture.channelPointsGiveaways,
    giveaways: fixture.subscriberGiveaways,
    "chat-participants": fixture.chatParticipants,
  };
}

export function createPerformanceFixture(): PerformanceFixture {
  const assigned = assignWins();
  const chatGiveaways: FixtureChatGiveaway[] = [];
  const channelPointsGiveaways: FixtureChannelPointsGiveaway[] = [];
  const subscriberGiveaways: FixtureSubscriberGiveaway[] = [];
  const chatParticipants: FixtureChatParticipantRow[] = [];
  const winsByViewer = new Uint16Array(VIEWERS);
  let lateChatEntries = 0;
  let undatedSubscriberWins = 0;
  let datedSubscriberWins = 0;
  let storedPeople = 0;
  let softDeleted = 0;
  let softDeletedWithSummary = 0;
  let giveawaysWithoutWinners = 0;

  for (let index = 0; index < GIVEAWAYS; index += 1) {
    const kind = kindOf(index);
    const id = giveawayId(index);
    const wins = assigned.get(index) ?? [];
    const soft = index % 7 === 0;
    const undated = isUndatedSubscriber(index);
    const createdMs = BASE_MS - 86_400_000 + index * 60_000;
    const createdAt = createdIso(index);
    const drawnMs = wins.map((win) => BASE_MS + win.slot * STEP_MS);
    const maxDrawn = drawnMs.length > 0 ? Math.max(...drawnMs) : undefined;
    const late =
      kind === "chat" &&
      index % 12 === 0 &&
      maxDrawn !== undefined;
    const people = peopleFor(
      index,
      wins.map((win) => win.user),
    );
    const joinedAt: number[] = [];
    for (let seat = 0; seat < people.length; seat += 1) {
      const winnerSeat = wins.findIndex((win) => win.user === people[seat]);
      let at = createdMs + seat * 1000;
      if (winnerSeat >= 0) {
        const drawn = drawnMs[winnerSeat];
        if (drawn !== undefined) at = drawn;
      }
      if (late && maxDrawn !== undefined && seat >= PEOPLE - 5) {
        at = maxDrawn + 60_000 + (seat - (PEOPLE - 5)) * 1000;
        lateChatEntries += 1;
      }
      joinedAt.push(at);
    }

    if (wins.length === 0) giveawaysWithoutWinners += 1;
    if (soft) softDeleted += 1;

    if (kind === "chat") {
      const participants: FixtureChatParticipant[] = people.map(
        (user, seat) => ({
          id: performanceViewerId(user),
          name: viewerLogin(user),
          displayName: viewerName(user),
          avatar: AVATAR,
          subscriber: user % 3 !== 0,
          subscriptionMonths: user % 36,
          tier: tierOf(user),
          joinedAt: joinedAt[seat] ?? createdMs,
        }),
      );
      const winners: FixtureChatWinner[] = wins.map((win) => {
        winsByViewer[win.user] = (winsByViewer[win.user] ?? 0) + 1;
        const drawn = BASE_MS + win.slot * STEP_MS;
        return {
          id: performanceViewerId(win.user),
          name: viewerName(win.user),
          twitchId: performanceViewerId(win.user),
          avatar: AVATAR,
          drawnAt: new Date(drawn).toISOString(),
        };
      });
      if (soft) {
        for (const winner of winners) {
          const person = participants.find((item) => item.id === winner.twitchId);
          if (!person) continue;
          winner.context = {
            subscriptionMonths: person.subscriptionMonths,
            tier: tierName(person.tier),
          };
        }
      }
      const record: FixtureChatGiveaway = {
        id,
        title: `Sorteio ${index}`,
        description: "Fixture de performance",
        keyword: "!drop",
        cost: 0,
        minimumSuscriptionTimeInMonths: 0,
        subscriberMultiplier: 2,
        subscribersOnly: false,
        winners,
        participants: soft ? [] : participants,
        createdAt,
        updatedAt: createdAt,
      };
      if (soft) {
        record.deletedAt = DELETED_AT;
        record.participation = {
          v: 1,
          users: participants.map((person, seat) => [
            person.id,
            person.displayName,
            Math.floor((joinedAt[seat] ?? createdMs) / 1000),
          ]),
        };
        softDeletedWithSummary += 1;
        storedPeople += record.participation.users.length;
      } else {
        storedPeople += participants.length;
        for (const person of participants) {
          chatParticipants.push({
            id: `${id}:${person.id}`,
            giveawayId: id,
            userId: person.id,
            name: person.name,
            displayName: person.displayName,
            avatar: person.avatar,
            subscriber: person.subscriber,
            subscriptionMonths: person.subscriptionMonths,
            tier: person.tier,
            joinedAt: person.joinedAt,
          });
        }
      }
      chatGiveaways.push(record);
      continue;
    }

    if (kind === "cp") {
      const participants: FixtureChannelPointsParticipant[] = people.map(
        (user, seat) => ({
          userId: performanceViewerId(user),
          name: viewerLogin(user),
          displayName: viewerName(user),
          avatar: AVATAR,
          subscriber: user % 3 !== 0,
          tier: tierOf(user),
          tickets: ticketsFor(user, joinedAt[seat] ?? createdMs, id),
        }),
      );
      const winners: FixtureChannelPointsWinner[] = wins.map((win, seat) => {
        winsByViewer[win.user] = (winsByViewer[win.user] ?? 0) + 1;
        const drawn = BASE_MS + win.slot * STEP_MS;
        return {
          id: `${id}-w${seat}`,
          userId: performanceViewerId(win.user),
          name: viewerName(win.user),
          avatar: AVATAR,
          redemptionId: `${id}-r${seat}`,
          drawnAt: new Date(drawn).toISOString(),
        };
      });
      const record: FixtureChannelPointsGiveaway = {
        id,
        title: `Sorteio ${index}`,
        description: "Fixture de performance",
        cost: 100,
        rewardId: `reward-${pad(index)}`,
        rewardEnabled: false,
        maxPerStream: null,
        subscribersOnly: false,
        subscriptionRequirement: 1000,
        subscriberMultiplier: MULTIPLIER,
        refundIneligible: false,
        allowMultipleWins: true,
        status: winners.length > 0 ? "closed" : "ready",
        participants: soft ? [] : participants,
        winners,
        createdAt,
        updatedAt: createdAt,
      };
      if (soft) {
        record.deletedAt = DELETED_AT;
        record.participation = {
          v: 1,
          users: participants.map((person, seat) => [
            person.userId,
            person.displayName,
            Math.floor((joinedAt[seat] ?? createdMs) / 1000),
            person.tickets.length,
          ]),
        };
        softDeletedWithSummary += 1;
        storedPeople += record.participation.users.length;
      } else {
        storedPeople += participants.length;
      }
      channelPointsGiveaways.push(record);
      continue;
    }

    const participants = people.map((user) => subscriberOf(user));
    const winners: FixtureSubscriber[] = wins.map((win) => {
      winsByViewer[win.user] = (winsByViewer[win.user] ?? 0) + 1;
      const drawn = BASE_MS + win.slot * STEP_MS;
      if (undated) {
        undatedSubscriberWins += 1;
        return subscriberOf(win.user);
      }
      datedSubscriberWins += 1;
      return subscriberOf(win.user, new Date(drawn).toISOString());
    });
    const record: FixtureSubscriberGiveaway = {
      id,
      title: `Sorteio ${index}`,
      description: "Fixture de performance",
      subscriptionRequirement: 1000,
      subscriberMultiplier: MULTIPLIER,
      participants: soft ? [] : participants,
      winners,
      spreadsheetUrl: null,
    };
    if (!undated) {
      record.createdAt = createdAt;
      record.updatedAt = createdAt;
    }
    if (soft) {
      record.deletedAt = DELETED_AT;
    } else {
      storedPeople += participants.length;
    }
    subscriberGiveaways.push(record);
  }

  let distinctWinners = 0;
  for (const count of winsByViewer) {
    if (count === 5) distinctWinners += 1;
    else if (count !== 0) {
      throw new Error(`viewer com ${count} vitórias`);
    }
  }

  const counts: PerformanceFixtureCounts = {
    giveaways:
      chatGiveaways.length +
      channelPointsGiveaways.length +
      subscriberGiveaways.length,
    wins: WINS,
    distinctWinners,
    peoplePerGiveaway: PEOPLE,
    storedPeople,
    chatParticipantRows: chatParticipants.length,
    softDeleted,
    softDeletedWithSummary,
    giveawaysWithoutWinners,
    undatedSubscriberWins,
    datedSubscriberWins,
    lateChatEntries,
    chat: chatGiveaways.length,
    channelPoints: channelPointsGiveaways.length,
    subscribers: subscriberGiveaways.length,
  };

  assertFixture({
    chatGiveaways,
    channelPointsGiveaways,
    subscriberGiveaways,
    chatParticipants,
    counts,
  });

  return {
    chatGiveaways,
    channelPointsGiveaways,
    subscriberGiveaways,
    chatParticipants,
    counts,
  };
}

function assertFixture(fixture: PerformanceFixture): void {
  const { counts } = fixture;
  if (counts.giveaways !== GIVEAWAYS) {
    throw new Error(`sorteios ${counts.giveaways}`);
  }
  if (counts.distinctWinners !== VIEWERS) {
    throw new Error(`viewers ${counts.distinctWinners}`);
  }
  if (counts.giveawaysWithoutWinners !== 100) {
    throw new Error(`sem vencedor ${counts.giveawaysWithoutWinners}`);
  }
  if (counts.softDeleted === 0 || counts.softDeletedWithSummary === 0) {
    throw new Error("soft-delete ausente");
  }
  if (counts.undatedSubscriberWins === 0 || counts.datedSubscriberWins === 0) {
    throw new Error("Subscribers sem os dois formatos de data");
  }
  if (counts.lateChatEntries === 0) {
    throw new Error("sem entrada depois do último drawnAt");
  }
  if (counts.chatParticipantRows === 0) {
    throw new Error("sem linhas de chat-participants");
  }
  if (counts.storedPeople < 40_000) {
    throw new Error(`pessoas armazenadas ${counts.storedPeople}`);
  }
  const activeChats = fixture.chatGiveaways.filter(
    (giveaway) => giveaway.deletedAt === undefined,
  );
  if (counts.chatParticipantRows !== activeChats.length * PEOPLE) {
    throw new Error("linhas de chat-participants fora do esperado");
  }
}
