import { getCatalogItem } from "./catalog";
import {
  calendarFromIso,
  monthCloseIso,
  parseInstant,
} from "./datetime";
import type { WinnerHistoryProvider } from "./history";
import {
  collapseFamilies,
  resolveHistory,
  type AchievementContext,
  type AchievementHit,
  type ComputeOptions,
} from "./moment-badges";
import { hasWonAt, sortWins, winRef } from "./order";
import {
  calendarGapAtLeast,
  consecutiveStreak,
} from "./timeline";
import type { BadgeAward, EngineClock, GiveawayType, WinEvent } from "./types";

const LUCKY_LEVELS = [
  { id: "lucky_25", min: 25 },
  { id: "lucky_10", min: 10 },
  { id: "lucky_5", min: 5 },
  { id: "lucky_3", min: 3 },
] as const;

function groupByUser(wins: readonly WinEvent[]): Map<string, WinEvent[]> {
  const grouped = new Map<string, WinEvent[]>();
  for (const win of sortWins(wins)) {
    const list = grouped.get(win.userKey);
    if (list) list.push(win);
    else grouped.set(win.userKey, [win]);
  }
  return grouped;
}

function fromHit(entry: AchievementHit): BadgeAward | null {
  const item = getCatalogItem(entry.id);
  if (!item) return null;
  const isKing = item.id === "month_king";
  return {
    id: item.id,
    family: item.family,
    kind: "achievement",
    rarity: entry.rarity ?? item.rarity,
    level: entry.level ?? item.level,
    catalogOrder: item.order,
    userKey: entry.userKey,
    newlyUnlocked: false,
    highlightEligible: !isKing,
    preview: Boolean(entry.win?.preview),
    count: entry.count,
    win: entry.win ? winRef(entry.win) : undefined,
    unlockedAt: entry.unlockedAt,
    month: entry.month,
    shared: entry.shared,
    sharedWith: entry.sharedWith,
    titleIndex: entry.titleIndex,
  };
}

function luckyHit(userKey: string, wins: readonly WinEvent[]): AchievementHit | null {
  const level = LUCKY_LEVELS.find((item) => wins.length >= item.min);
  if (!level) return null;
  const source = wins[level.min - 1];
  if (!source) return null;
  return {
    id: level.id,
    userKey,
    win: source,
    unlockedAt: source.wonAt,
    count: wins.length,
  };
}

function collectorHit(
  userKey: string,
  wins: readonly WinEvent[],
): AchievementHit | null {
  const seen = new Set<GiveawayType>();
  for (const win of wins) {
    seen.add(win.giveawayType);
    if (seen.size < 3) continue;
    return {
      id: "collector",
      userKey,
      win,
      unlockedAt: win.wonAt,
      count: 3,
    };
  }
  return null;
}

function eternalHit(
  userKey: string,
  wins: readonly WinEvent[],
  timeZone: string,
): AchievementHit | null {
  const dated: WinEvent[] = [];
  for (const win of wins) {
    if (!hasWonAt(win)) continue;
    dated.push(win);
    if (consecutiveStreak(dated, timeZone) < 7) continue;
    return {
      id: "eternal_flame",
      userKey,
      win,
      unlockedAt: win.wonAt,
      count: 7,
    };
  }
  return null;
}

function phoenixHit(
  userKey: string,
  wins: readonly WinEvent[],
  timeZone: string,
): AchievementHit | null {
  let previous: WinEvent | undefined;
  for (const win of wins) {
    if (!hasWonAt(win)) continue;
    if (previous) {
      const prevDay = calendarFromIso(previous.wonAt, timeZone);
      const day = calendarFromIso(win.wonAt, timeZone);
      if (prevDay && day && calendarGapAtLeast(prevDay, day, 6)) {
        return {
          id: "phoenix",
          userKey,
          win,
          unlockedAt: win.wonAt,
          count: 6,
        };
      }
    }
    previous = win;
  }
  return null;
}

function monthKingHits(
  wins: readonly WinEvent[],
  clock: EngineClock,
): AchievementHit[] {
  const now = parseInstant(clock.now);
  if (now === null) return [];
  const buckets = new Map<
    string,
    { year: number; month: number; counts: Map<string, number> }
  >();
  for (const win of wins) {
    const day = calendarFromIso(win.wonAt, clock.timeZone);
    if (!day) continue;
    const key = `${day.year}-${day.month}`;
    const bucket = buckets.get(key) ?? {
      year: day.year,
      month: day.month,
      counts: new Map<string, number>(),
    };
    bucket.counts.set(win.userKey, (bucket.counts.get(win.userKey) ?? 0) + 1);
    buckets.set(key, bucket);
  }
  const ordered = [...buckets.values()].sort((a, b) =>
    a.year === b.year ? a.month - b.month : a.year - b.year,
  );
  const titles = new Map<string, number>();
  const hits: AchievementHit[] = [];
  for (const bucket of ordered) {
    const close = monthCloseIso(bucket.year, bucket.month, clock.timeZone);
    const closeMs = parseInstant(close ?? undefined);
    if (!close || closeMs === null || now < closeMs) continue;
    let max = 0;
    for (const count of bucket.counts.values()) max = Math.max(max, count);
    if (max < 2) continue;
    const leaders = [...bucket.counts.entries()].filter(
      ([, count]) => count === max,
    );
    const shared = leaders.length > 1;
    for (const [userKey, monthWins] of leaders) {
      const titleIndex = (titles.get(userKey) ?? 0) + 1;
      titles.set(userKey, titleIndex);
      hits.push({
        id: "month_king",
        userKey,
        unlockedAt: close,
        count: monthWins,
        month: { year: bucket.year, month: bucket.month },
        shared,
        sharedWith: leaders.length - 1,
        titleIndex,
      });
    }
  }
  return hits;
}

export function computeAchievements(
  provider: WinnerHistoryProvider,
  clock: EngineClock,
  options?: ComputeOptions,
): BadgeAward[] {
  const { wins } = resolveHistory(provider, clock, options);
  const byUser = groupByUser(wins);
  const hits: AchievementHit[] = [];
  for (const [userKey, userWins] of byUser) {
    const lucky = luckyHit(userKey, userWins);
    const collector = collectorHit(userKey, userWins);
    const eternal = eternalHit(userKey, userWins, clock.timeZone);
    const phoenix = phoenixHit(userKey, userWins, clock.timeZone);
    if (lucky) hits.push(lucky);
    if (collector) hits.push(collector);
    if (eternal) hits.push(eternal);
    if (phoenix) hits.push(phoenix);
  }
  hits.push(...monthKingHits(wins, clock));

  const ctx: AchievementContext = { wins, byUser, clock };
  for (const rule of Object.values(options?.rules?.achievement ?? {})) {
    if (!rule) continue;
    for (const entry of rule(ctx) ?? []) {
      const item = getCatalogItem(entry.id);
      if (!item || item.phase !== "later") continue;
      hits.push(entry);
    }
  }

  const awards: BadgeAward[] = [];
  for (const entry of hits) {
    const award = fromHit(entry);
    if (award) awards.push(award);
  }
  const kings = awards.filter((award) => award.id === "month_king");
  const others = collapseFamilies(
    awards.filter((award) => award.id !== "month_king"),
  );
  return [...others, ...kings];
}
