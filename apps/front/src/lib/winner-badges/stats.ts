import {
  addCalendarDays,
  calendarDayIndex,
  calendarFromIso,
  dateKey,
  DAY_MS,
  parseInstant,
  sameCalendarMonth,
} from "./datetime";
import type { WinnerHistoryProvider } from "./history";
import { resolveHistory, type ComputeOptions } from "./moment-badges";
import { hasWonAt, sameWin, sortWins } from "./order";
import { consecutiveStreak } from "./timeline";
import type { EngineClock, GiveawayType, WinEvent } from "./types";

export type ViewerStats = {
  userKey: string;
  name: string;
  avatar?: string;
  totals: {
    all: number;
    chat: number;
    "channel-points": number;
    subscribers: number;
  };
  undatedWins: number;
  firstWinAt?: string;
  lastWinAt?: string;
  /** Dias-calendário desde a última vitória com data. */
  daysSinceLastWin?: number;
  wins24h: number;
  wins7d: number;
  winsThisMonth: number;
  currentStreak: number;
  bestStreak: number;
  distinctGiveaways: number;
  /** Posição no mês corrente. Empate usa rank 1, 2, 2, 4. */
  monthPosition?: number;
};

export type RankedWinner = {
  userKey: string;
  name: string;
  avatar?: string;
  wins: number;
  lastWinAt?: string;
};

export type ChannelStats = {
  topWinnersMonth: RankedWinner[];
  topWinnersAll: RankedWinner[];
  distinctWinners: number;
  firstDropThisMonth: {
    wins: number;
    firstDrops: number;
    percent: number | null;
  };
  /** Dias empatados com mais sorteios distintos. */
  busiestDays: { date: string; giveaways: number }[];
};

export type StatsResult = {
  viewers: ViewerStats[];
  channel: ChannelStats;
  includesPreview: boolean;
};

function groupByUser(wins: readonly WinEvent[]): Map<string, WinEvent[]> {
  const grouped = new Map<string, WinEvent[]>();
  for (const win of sortWins(wins)) {
    const list = grouped.get(win.userKey);
    if (list) list.push(win);
    else grouped.set(win.userKey, [win]);
  }
  return grouped;
}

function giveawayKey(win: WinEvent): string {
  return `${win.giveawayType}:${win.giveawayId}`;
}

function compareRank(a: RankedWinner, b: RankedWinner): number {
  if (b.wins !== a.wins) return b.wins - a.wins;
  const aTime = a.lastWinAt ? Date.parse(a.lastWinAt) : Number.NEGATIVE_INFINITY;
  const bTime = b.lastWinAt ? Date.parse(b.lastWinAt) : Number.NEGATIVE_INFINITY;
  if (bTime !== aTime) return bTime - aTime;
  return a.name.localeCompare(b.name, "pt-BR");
}

function bestStreakOf(wins: readonly WinEvent[], timeZone: string): number {
  const dated: WinEvent[] = [];
  let best = 0;
  for (const win of wins) {
    if (!hasWonAt(win)) continue;
    dated.push(win);
    best = Math.max(best, consecutiveStreak(dated, timeZone));
  }
  return best;
}

function emptyTotals(): ViewerStats["totals"] {
  return { all: 0, chat: 0, "channel-points": 0, subscribers: 0 };
}

function addTotal(
  totals: ViewerStats["totals"],
  type: GiveawayType,
): void {
  totals.all += 1;
  totals[type] += 1;
}

export function computeStats(
  provider: WinnerHistoryProvider,
  clock: EngineClock,
  options?: ComputeOptions,
): StatsResult {
  const { wins, preview } = resolveHistory(provider, clock, options);
  const ordered = sortWins(wins);
  const byUser = groupByUser(ordered);
  const now = parseInstant(clock.now);
  const today = calendarFromIso(clock.now, clock.timeZone);
  const weekStart = today ? addCalendarDays(today, -6) : null;
  const monthLastAt = new Map<string, string>();
  const viewers: ViewerStats[] = [];

  for (const [userKey, userWins] of byUser) {
    const latest = userWins[userWins.length - 1];
    const totals = emptyTotals();
    const giveaways = new Set<string>();
    let undatedWins = 0;
    let firstWinAt: string | undefined;
    let lastWinAt: string | undefined;
    let wins24h = 0;
    let wins7d = 0;
    let winsThisMonth = 0;

    for (const win of userWins) {
      addTotal(totals, win.giveawayType);
      giveaways.add(giveawayKey(win));
      const instant = parseInstant(win.wonAt);
      if (instant === null) {
        undatedWins += 1;
        continue;
      }
      if (!firstWinAt || instant < Date.parse(firstWinAt)) {
        firstWinAt = win.wonAt;
      }
      if (!lastWinAt || instant > Date.parse(lastWinAt)) {
        lastWinAt = win.wonAt;
      }
      if (now !== null && instant > now - DAY_MS && instant <= now) {
        wins24h += 1;
      }
      const day = calendarFromIso(win.wonAt, clock.timeZone);
      if (day && today && weekStart && (now === null || instant <= now)) {
        const index = calendarDayIndex(day);
        const start = calendarDayIndex(weekStart);
        const end = calendarDayIndex(today);
        if (index >= start && index <= end) wins7d += 1;
      }
      if (day && today && sameCalendarMonth(day, today)) {
        winsThisMonth += 1;
        const previous = monthLastAt.get(userKey);
        if (!previous || instant > Date.parse(previous)) {
          if (win.wonAt) monthLastAt.set(userKey, win.wonAt);
        }
      }
    }

    const lastDay = calendarFromIso(lastWinAt, clock.timeZone);
    let daysSinceLastWin: number | undefined;
    let currentStreak = 0;
    if (today && lastDay) {
      daysSinceLastWin =
        calendarDayIndex(today) - calendarDayIndex(lastDay);
      const yesterday = dateKey(addCalendarDays(today, -1));
      const onToday = dateKey(lastDay) === dateKey(today);
      const onYesterday = dateKey(lastDay) === yesterday;
      if (onToday || onYesterday) {
        currentStreak = consecutiveStreak(userWins, clock.timeZone);
      }
    }

    viewers.push({
      userKey,
      name: latest?.name ?? "",
      avatar: latest?.avatar,
      totals,
      undatedWins,
      firstWinAt,
      lastWinAt,
      daysSinceLastWin,
      wins24h,
      wins7d,
      winsThisMonth,
      currentStreak,
      bestStreak: bestStreakOf(userWins, clock.timeZone),
      distinctGiveaways: giveaways.size,
    });
  }

  const rankedMonth: RankedWinner[] = viewers
    .filter((viewer) => viewer.winsThisMonth > 0)
    .map((viewer) => ({
      userKey: viewer.userKey,
      name: viewer.name,
      avatar: viewer.avatar,
      wins: viewer.winsThisMonth,
      lastWinAt: monthLastAt.get(viewer.userKey),
    }))
    .sort(compareRank);

  const positionByUser = new Map<string, number>();
  let seen = 0;
  let rank = 0;
  let previousWins = -1;
  for (const row of rankedMonth) {
    seen += 1;
    if (row.wins !== previousWins) {
      rank = seen;
      previousWins = row.wins;
    }
    positionByUser.set(row.userKey, rank);
  }

  const published = viewers
    .map((viewer) => ({
      ...viewer,
      monthPosition: positionByUser.get(viewer.userKey),
    }))
    .sort((a, b) => a.userKey.localeCompare(b.userKey));

  const topWinnersAll: RankedWinner[] = published
    .filter((viewer) => viewer.totals.all > 0)
    .map((viewer) => ({
      userKey: viewer.userKey,
      name: viewer.name,
      avatar: viewer.avatar,
      wins: viewer.totals.all,
      lastWinAt: viewer.lastWinAt,
    }))
    .sort(compareRank);

  let monthWins = 0;
  let firstDrops = 0;
  if (today) {
    for (const win of ordered) {
      if (!hasWonAt(win)) continue;
      const day = calendarFromIso(win.wonAt, clock.timeZone);
      if (!day || !sameCalendarMonth(day, today)) continue;
      monthWins += 1;
      const first = byUser.get(win.userKey)?.[0];
      if (first && sameWin(first, win) && hasWonAt(first)) firstDrops += 1;
    }
  }

  const byDay = new Map<string, Set<string>>();
  for (const win of ordered) {
    const day = calendarFromIso(win.wonAt, clock.timeZone);
    if (!day) continue;
    const key = dateKey(day);
    const set = byDay.get(key) ?? new Set<string>();
    set.add(giveawayKey(win));
    byDay.set(key, set);
  }
  let peak = 0;
  for (const set of byDay.values()) peak = Math.max(peak, set.size);
  const busiestDays =
    peak === 0
      ? []
      : [...byDay.entries()]
          .filter(([, set]) => set.size === peak)
          .map(([date, set]) => ({ date, giveaways: set.size }))
          .sort((a, b) => (a.date < b.date ? 1 : -1));

  return {
    includesPreview: Boolean(preview),
    viewers: published,
    channel: {
      topWinnersMonth: rankedMonth,
      topWinnersAll,
      distinctWinners: published.length,
      firstDropThisMonth: {
        wins: monthWins,
        firstDrops,
        percent: monthWins === 0 ? null : (firstDrops / monthWins) * 100,
      },
      busiestDays,
    },
  };
}
