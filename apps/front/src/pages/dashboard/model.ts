import { BADGE_CATALOG, getCatalogItem } from "@/lib/winner-badges/catalog";
import { calendarFromIso, parseInstant, sameCalendarMonth } from "@/lib/winner-badges/datetime";
import { createMemoryHistoryProvider } from "@/lib/winner-badges/history";
import { normalizeWinnerHistory } from "@/lib/winner-badges/normalize";
import { collectWinAwards, selectForDisplay } from "@/lib/winner-badges/select-for-display";
import { computeAchievements } from "@/lib/winner-badges/achievements";
import { computeStats } from "@/lib/winner-badges/stats";
import {
  compareWins,
  hasWonAt,
  makeUserKey,
} from "@/lib/winner-badges/order";
import type {
  BadgeAward,
  EngineClock,
  GiveawayType,
  Rarity,
  WinEvent,
} from "@/lib/winner-badges/types";
import type { ViewerStats } from "@/lib/winner-badges/stats";
import type { DashboardSource } from "./source";
import type { DashboardPeriod, DashboardType } from "./preferences";

/**
 * Vista da Dashboard v1. Função pura: não lê nem grava IndexedDB,
 * localStorage, sessionStorage, cookie ou token.
 * Blocos 4 e 5 (azarados e participantes) ficam para a v2.
 */

export const RECENT_WINNERS_LIMIT = 10;
export const RECENT_ACHIEVEMENTS_LIMIT = 8;
export const TOP_WINNERS_LIMIT = 10;

export type DashboardFilters = {
  period: DashboardPeriod;
  type: DashboardType;
};

export type DashboardBadge = {
  id: string;
  name: string;
  emoji: string;
  rarity: Rarity;
};

export type DashboardPerson = {
  userKey: string;
  platform: string;
  userId: string;
  name: string;
  avatar?: string;
  /** Sem id confiável: aparece no feed, sem link de perfil. */
  linked: boolean;
};

export type RecentWinner = DashboardPerson & {
  giveawayType: GiveawayType;
  giveawayId: string;
  giveawayTitle: string;
  deleted: boolean;
  wonAt: string;
  badges: DashboardBadge[];
};

export type AchievementFeedItem = DashboardPerson & {
  key: string;
  achievementId: string;
  emoji: string;
  rarity: Rarity;
  catalogName: string;
  month?: { year: number; month: number };
  shared: boolean;
  unlockedAt?: string;
};

export type TopWinner = DashboardPerson & {
  position: number;
  wins: number;
  byType: Record<GiveawayType, number>;
};

export type DashboardView = {
  /** Nenhum sorteio de Chat, Pontos ou Subscribers. */
  empty: boolean;
  summary: {
    giveaways: number;
    wins: number;
    /** `null` com os selos desligados: o card não aparece. */
    achievements: number | null;
  };
  recentWinners: RecentWinner[];
  recentAchievements: AchievementFeedItem[];
  topWinners: TopWinner[];
  showAchievements: boolean;
};

export type ProfileAchievement = {
  key: string;
  id: string;
  name: string;
  emoji: string;
  rarity: Rarity;
  unlocked: boolean;
  month?: { year: number; month: number };
  shared: boolean;
  times?: number;
};

export type ViewerProfile = {
  userKey: string;
  platform: string;
  userId: string;
  name: string;
  avatar?: string;
  stats: ViewerStats;
  moments: DashboardBadge[];
  showcase: ProfileAchievement[];
  grid: ProfileAchievement[];
};

type GiveawayMeta = {
  type: GiveawayType;
  id: string;
  title: string;
  createdAt?: string;
  deleted: boolean;
};

type UnknownWin = {
  platform: string;
  userId: string;
  name: string;
  avatar?: string;
  giveawayType: GiveawayType;
  giveawayId: string;
  index: number;
  wonAt: string;
};

const EMPTY_BY_TYPE = (): Record<GiveawayType, number> => ({
  chat: 0,
  "channel-points": 0,
  subscribers: 0,
});

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function readString(record: Record<string, unknown>, key: string): string | undefined {
  const value = record[key];
  return typeof value === "string" ? value : undefined;
}

function validInstant(value: string | undefined): string | undefined {
  if (!value || !Number.isFinite(Date.parse(value))) return undefined;
  return value;
}

function giveawayKey(type: GiveawayType, id: string): string {
  return `${type}:${id}`;
}

function readMeta(
  record: Record<string, unknown>,
  type: GiveawayType,
): GiveawayMeta | null {
  const id = readString(record, "id");
  if (!id) return null;
  const deletedAt = readString(record, "deletedAt");
  return {
    type,
    id,
    title: readString(record, "title")?.trim() ?? "",
    createdAt: validInstant(readString(record, "createdAt")),
    deleted: typeof deletedAt === "string" && deletedAt.length > 0,
  };
}

function collectMetas(source: DashboardSource): GiveawayMeta[] {
  const metas: GiveawayMeta[] = [];
  const groups: Array<[unknown, GiveawayType]> = [
    [source.chat, "chat"],
    [source.channelPoints, "channel-points"],
    [source.subscribers, "subscribers"],
  ];
  for (const [rows, type] of groups) {
    for (const item of asArray(rows)) {
      const record = asRecord(item);
      if (!record) continue;
      const meta = readMeta(record, type);
      if (meta) metas.push(meta);
    }
  }
  return metas;
}

function inCurrentMonth(iso: string | undefined, clock: EngineClock): boolean {
  const day = calendarFromIso(iso, clock.timeZone);
  const today = calendarFromIso(clock.now, clock.timeZone);
  if (!day || !today) return false;
  return sameCalendarMonth(day, today);
}

function giveawayInPeriod(
  createdAt: string | undefined,
  period: DashboardPeriod,
  clock: EngineClock,
): boolean {
  if (!createdAt) return period === "all";
  if (period === "all") return true;
  return inCurrentMonth(createdAt, clock);
}

function typeMatches(type: GiveawayType, filter: DashboardType): boolean {
  return filter === "all" || filter === type;
}

function isHiddenUser(
  platform: string,
  userId: string,
  excluded: ReadonlySet<string>,
  broadcasterId: string | null | undefined,
): boolean {
  if (!userId || userId === "unknown") {
    return userId === "unknown" && excluded.has("unknown");
  }
  if (broadcasterId && userId === broadcasterId) return true;
  if (platform === "twitch" && excluded.has(userId)) return true;
  return false;
}

function winnerUserId(
  winner: Record<string, unknown>,
  type: GiveawayType,
): string | undefined {
  if (type === "chat") return readString(winner, "twitchId");
  if (type === "channel-points") return readString(winner, "userId");
  return readString(winner, "user_id");
}

function winnerName(
  winner: Record<string, unknown>,
  type: GiveawayType,
): string {
  if (type === "subscribers") {
    return readString(winner, "user_name") ?? readString(winner, "user_login") ?? "";
  }
  return readString(winner, "name") ?? "";
}

function collectUnknown(
  rows: unknown,
  type: GiveawayType,
): UnknownWin[] {
  const found: UnknownWin[] = [];
  for (const item of asArray(rows)) {
    const giveaway = asRecord(item);
    if (!giveaway) continue;
    const id = readString(giveaway, "id");
    if (!id) continue;
    asArray(giveaway.winners).forEach((value, index) => {
      const winner = asRecord(value);
      if (!winner) return;
      const userId = winnerUserId(winner, type);
      if (userId && userId !== "unknown") return;
      const wonAt = validInstant(readString(winner, "drawnAt"));
      if (!wonAt) return;
      found.push({
        platform: "twitch",
        userId: userId ?? "",
        name: winnerName(winner, type),
        avatar: readString(winner, "avatar"),
        giveawayType: type,
        giveawayId: id,
        index,
        wonAt,
      });
    });
  }
  return found;
}

function toBadge(award: BadgeAward): DashboardBadge {
  const item = getCatalogItem(award.id);
  return {
    id: award.id,
    name: item?.name ?? award.id,
    emoji: item?.emoji ?? "",
    rarity: award.rarity,
  };
}

function personFromWin(win: WinEvent): DashboardPerson {
  return {
    userKey: win.userKey,
    platform: win.platform,
    userId: win.userId,
    name: win.name,
    avatar: win.avatar,
    linked: true,
  };
}

function compareRecent(
  a: { wonAt: string; giveawayId: string; index: number },
  b: { wonAt: string; giveawayId: string; index: number },
): number {
  const aMs = Date.parse(a.wonAt);
  const bMs = Date.parse(b.wonAt);
  if (aMs !== bMs) return bMs - aMs;
  if (a.giveawayId !== b.giveawayId) return a.giveawayId < b.giveawayId ? 1 : -1;
  return b.index - a.index;
}

type RankBucket = {
  person: DashboardPerson;
  wins: number;
  byType: Record<GiveawayType, number>;
  lastWinAt?: string;
  best?: WinEvent;
};

export function buildDashboardView(
  source: DashboardSource,
  clock: EngineClock,
  filters: DashboardFilters,
  options: { badgesEnabled: boolean; broadcasterId?: string | null },
): DashboardView {
  const metas = collectMetas(source);
  const metaByKey = new Map(
    metas.map((meta) => [giveawayKey(meta.type, meta.id), meta]),
  );
  const excluded = new Set(source.excludedUserIds);
  const broadcasterId = options.broadcasterId ?? null;
  const wins = normalizeWinnerHistory({
    chat: source.chat,
    channelPoints: source.channelPoints,
    subscribers: source.subscribers,
  });
  const provider = createMemoryHistoryProvider(wins);

  const visibleWins = wins.filter((win) => {
    if (isHiddenUser(win.platform, win.userId, excluded, broadcasterId)) {
      return false;
    }
    if (!typeMatches(win.giveawayType, filters.type)) return false;
    if (!hasWonAt(win)) return filters.period === "all";
    if (filters.period === "all") return true;
    return inCurrentMonth(win.wonAt, clock);
  });

  const giveaways = metas.filter(
    (meta) =>
      typeMatches(meta.type, filters.type) &&
      giveawayInPeriod(meta.createdAt, filters.period, clock),
  ).length;

  const recentPool: Array<RecentWinner & { index: number }> = [];
  for (const win of wins) {
    if (!hasWonAt(win)) continue;
    if (isHiddenUser(win.platform, win.userId, excluded, broadcasterId)) continue;
    if (!typeMatches(win.giveawayType, filters.type)) continue;
    if (filters.period === "month" && !inCurrentMonth(win.wonAt, clock)) continue;
    const meta = metaByKey.get(giveawayKey(win.giveawayType, win.giveawayId));
    const badges = options.badgesEnabled
      ? selectForDisplay(collectWinAwards(provider, win, clock)).log.map(toBadge)
      : [];
    recentPool.push({
      ...personFromWin(win),
      giveawayType: win.giveawayType,
      giveawayId: win.giveawayId,
      giveawayTitle: meta?.title ?? "",
      deleted: meta?.deleted ?? false,
      wonAt: win.wonAt ?? "",
      badges,
      index: win.index,
    });
  }

  const unknownRows = [
    ...collectUnknown(source.chat, "chat"),
    ...collectUnknown(source.channelPoints, "channel-points"),
    ...collectUnknown(source.subscribers, "subscribers"),
  ];
  for (const row of unknownRows) {
    if (isHiddenUser(row.platform, row.userId || "unknown", excluded, broadcasterId)) {
      continue;
    }
    if (!typeMatches(row.giveawayType, filters.type)) continue;
    if (filters.period === "month" && !inCurrentMonth(row.wonAt, clock)) continue;
    const meta = metaByKey.get(giveawayKey(row.giveawayType, row.giveawayId));
    recentPool.push({
      userKey: "",
      platform: row.platform,
      userId: row.userId,
      name: row.name,
      avatar: row.avatar,
      linked: false,
      giveawayType: row.giveawayType,
      giveawayId: row.giveawayId,
      giveawayTitle: meta?.title ?? "",
      deleted: meta?.deleted ?? false,
      wonAt: row.wonAt,
      badges: [],
      index: row.index,
    });
  }

  recentPool.sort(compareRecent);
  const recentWinners: RecentWinner[] = recentPool
    .slice(0, RECENT_WINNERS_LIMIT)
    .map((row) => ({
      userKey: row.userKey,
      platform: row.platform,
      userId: row.userId,
      name: row.name,
      avatar: row.avatar,
      linked: row.linked,
      giveawayType: row.giveawayType,
      giveawayId: row.giveawayId,
      giveawayTitle: row.giveawayTitle,
      deleted: row.deleted,
      wonAt: row.wonAt,
      badges: row.badges,
    }));

  const ranked = new Map<string, RankBucket>();
  for (const win of visibleWins) {
    const bucket = ranked.get(win.userKey) ?? {
      person: personFromWin(win),
      wins: 0,
      byType: EMPTY_BY_TYPE(),
      best: undefined,
    };
    bucket.wins += 1;
    bucket.byType[win.giveawayType] += 1;
    if (!bucket.best || compareWins(win, bucket.best) > 0) {
      bucket.best = win;
      bucket.person = personFromWin(win);
      if (hasWonAt(win)) bucket.lastWinAt = win.wonAt;
    }
    ranked.set(win.userKey, bucket);
  }

  const topWinners: TopWinner[] = [...ranked.values()]
    .sort((a, b) => {
      if (b.wins !== a.wins) return b.wins - a.wins;
      const aTime = a.lastWinAt ? Date.parse(a.lastWinAt) : Number.NEGATIVE_INFINITY;
      const bTime = b.lastWinAt ? Date.parse(b.lastWinAt) : Number.NEGATIVE_INFINITY;
      if (bTime !== aTime) return bTime - aTime;
      return a.person.name.localeCompare(b.person.name, "pt-BR");
    })
    .slice(0, TOP_WINNERS_LIMIT)
    .map((bucket, index) => ({
      ...bucket.person,
      position: index + 1,
      wins: bucket.wins,
      byType: bucket.byType,
    }));

  let recentAchievements: AchievementFeedItem[] = [];
  let achievementCount: number | null = null;
  if (options.badgesEnabled) {
    const latest = new Map<string, WinEvent>();
    for (const win of wins) {
      const current = latest.get(win.userKey);
      if (!current || compareWins(win, current) > 0) latest.set(win.userKey, win);
    }
    const names = new Map<string, DashboardPerson>();
    for (const [userKey, win] of latest) {
      if (isHiddenUser(win.platform, win.userId, excluded, broadcasterId)) continue;
      names.set(userKey, personFromWin(win));
    }

    const awards = computeAchievements(provider, clock).filter((award) => {
      const person = names.get(award.userKey);
      if (!person) return false;
      if (filters.type !== "all") {
        if (!award.win || award.win.giveawayType !== filters.type) return false;
      }
      if (!award.unlockedAt) return filters.period === "all";
      if (filters.period === "all") return true;
      return inCurrentMonth(award.unlockedAt, clock);
    });
    awards.sort((a, b) => {
      const aMs = parseInstant(a.unlockedAt) ?? Number.NEGATIVE_INFINITY;
      const bMs = parseInstant(b.unlockedAt) ?? Number.NEGATIVE_INFINITY;
      if (aMs !== bMs) return bMs - aMs;
      const aName = names.get(a.userKey)?.name ?? "";
      const bName = names.get(b.userKey)?.name ?? "";
      const byName = aName.localeCompare(bName, "pt-BR");
      if (byName !== 0) return byName;
      return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
    });
    achievementCount = awards.length;
    recentAchievements = awards.slice(0, RECENT_ACHIEVEMENTS_LIMIT).map((award) => {
      const person = names.get(award.userKey);
      const item = getCatalogItem(award.id);
      const monthKey = award.month
        ? `${award.month.year}-${award.month.month}`
        : award.unlockedAt ?? award.id;
      return {
        userKey: person?.userKey ?? award.userKey,
        platform: person?.platform ?? "twitch",
        userId: person?.userId ?? "",
        name: person?.name ?? "",
        avatar: person?.avatar,
        linked: Boolean(person?.linked && person.userId && person.userId !== "unknown"),
        key: `${award.id}:${award.userKey}:${monthKey}`,
        achievementId: award.id,
        emoji: item?.emoji ?? "",
        rarity: award.rarity,
        catalogName: item?.name ?? award.id,
        month: award.month,
        shared: Boolean(award.shared),
        unlockedAt: award.unlockedAt,
      };
    });
  }

  return {
    empty: metas.length === 0,
    summary: {
      giveaways,
      wins: visibleWins.length,
      achievements: achievementCount,
    },
    recentWinners,
    recentAchievements,
    topWinners,
    showAchievements: options.badgesEnabled,
  };
}

function familyLevel(awards: readonly BadgeAward[], family: string): number {
  let level = 0;
  for (const award of awards) {
    if (award.family === family) level = Math.max(level, award.level);
  }
  return level;
}

export function buildViewerProfile(
  source: DashboardSource,
  clock: EngineClock,
  platform: string,
  userId: string,
): ViewerProfile | null {
  if (!userId || userId === "unknown") return null;
  const wins = normalizeWinnerHistory({
    chat: source.chat,
    channelPoints: source.channelPoints,
    subscribers: source.subscribers,
  });
  const userKey = makeUserKey(platform, userId);
  const provider = createMemoryHistoryProvider(wins);
  const stats = computeStats(provider, clock).viewers.find(
    (viewer) => viewer.userKey === userKey,
  );
  if (!stats) return null;

  const userWins = wins.filter((win) => win.userKey === userKey);
  const moments = new Map<string, BadgeAward>();
  for (const win of userWins) {
    for (const award of collectWinAwards(provider, win, clock)) {
      if (award.kind !== "moment") continue;
      const previous = moments.get(award.family);
      if (!previous || award.level > previous.level) moments.set(award.family, award);
    }
  }

  const achievements = computeAchievements(provider, clock).filter(
    (award) => award.userKey === userKey,
  );
  const kings = achievements.filter((award) => award.id === "month_king");
  const grid: ProfileAchievement[] = [];
  for (const item of BADGE_CATALOG) {
    if (item.kind !== "achievement" || item.phase !== "mvp") continue;
    if (item.id === "month_king") {
      if (kings.length === 0) {
        grid.push({
          key: "month_king",
          id: item.id,
          name: item.name,
          emoji: item.emoji,
          rarity: item.rarity,
          unlocked: false,
          shared: false,
        });
      } else {
        const ordered = [...kings].sort((a, b) => {
          const aMs = parseInstant(a.unlockedAt) ?? 0;
          const bMs = parseInstant(b.unlockedAt) ?? 0;
          return bMs - aMs;
        });
        ordered.forEach((award, index) => {
          grid.push({
            key: `month_king:${award.month?.year ?? index}:${award.month?.month ?? index}`,
            id: item.id,
            name: item.name,
            emoji: item.emoji,
            rarity: award.rarity,
            unlocked: true,
            month: award.month,
            shared: Boolean(award.shared),
            times: award.titleIndex,
          });
        });
      }
      continue;
    }
    grid.push({
      key: item.id,
      id: item.id,
      name: item.name,
      emoji: item.emoji,
      rarity: item.rarity,
      unlocked: familyLevel(achievements, item.family) >= item.level,
      shared: false,
    });
  }

  const showcase = grid
    .filter((item) => item.unlocked)
    .sort((a, b) => {
      const rank = rarityRank(b.rarity) - rarityRank(a.rarity);
      if (rank !== 0) return rank;
      return a.name.localeCompare(b.name, "pt-BR");
    });

  return {
    userKey,
    platform: userWins[0]?.platform ?? platform,
    userId,
    name: stats.name,
    avatar: stats.avatar,
    stats,
    moments: [...moments.values()]
      .sort((a, b) => a.catalogOrder - b.catalogOrder)
      .map(toBadge),
    showcase,
    grid,
  };
}

function rarityRank(rarity: Rarity): number {
  switch (rarity) {
    case "common":
      return 0;
    case "uncommon":
      return 1;
    case "rare":
      return 2;
    case "epic":
      return 3;
    case "legendary":
      return 4;
  }
}

export function giveawayPath(type: GiveawayType, id: string): string {
  if (type === "chat") return `/dashboard/chat-giveaway/${encodeURIComponent(id)}`;
  if (type === "channel-points") {
    return `/dashboard/channel-points-giveaway/${encodeURIComponent(id)}`;
  }
  return `/dashboard/follower-giveaway/${encodeURIComponent(id)}`;
}

export function viewerPath(platform: string, userId: string): string {
  return `/dashboard/viewer/${encodeURIComponent(platform)}/${encodeURIComponent(userId)}`;
}
