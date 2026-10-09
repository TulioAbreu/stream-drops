import { getCatalogItem } from "./catalog";
import {
  calendarFromIso,
  dateKey,
  DAY_MS,
  parseInstant,
  sameCalendarMonth,
} from "./datetime";
import {
  calendarGapAtLeast,
  consecutiveStreak,
  previousDatedWin,
} from "./timeline";
import { loadWins, toPreview } from "./history";
import { compareWins, hasWonAt, sameWin, sortWins, winRef } from "./order";
import type {
  BadgeAward,
  CalendarDate,
  EngineClock,
  Rarity,
  WinEvent,
} from "./types";
import type { WinnerHistoryProvider } from "./history";

export type MomentHit = {
  id: string;
  rarity?: Rarity;
  level?: number;
  count?: number;
};

export type MomentContext = {
  win: WinEvent;
  /** Vitórias deste viewer até W, inclusive, na ordem total. */
  userPrefix: readonly WinEvent[];
  /** Vitórias de todos até W, inclusive. */
  historyPrefix: readonly WinEvent[];
  timeZone: string;
};

export type MomentRule = (ctx: MomentContext) => MomentHit | null;

export type ExtraRules = {
  moment?: Partial<Record<string, MomentRule>>;
  achievement?: Partial<Record<string, AchievementRule>>;
};

export type AchievementHit = {
  id: string;
  userKey: string;
  unlockedAt?: string;
  win?: WinEvent;
  count?: number;
  rarity?: Rarity;
  level?: number;
  month?: { year: number; month: number };
  shared?: boolean;
  sharedWith?: number;
  titleIndex?: number;
};

export type AchievementContext = {
  wins: readonly WinEvent[];
  byUser: ReadonlyMap<string, readonly WinEvent[]>;
  clock: EngineClock;
};

export type AchievementRule = (
  ctx: AchievementContext,
) => AchievementHit[] | null;

export type ComputeOptions = {
  /**
   * Pendente. Entra só neste cálculo, com `wonAt = clock.now`.
   * Descartar a prévia é não passá-la de novo (CA2).
   */
  preview?: WinEvent;
  /**
   * Regras da fase Depois (Azarão, Fim da seca, Última hora,
   * Carrasco). A API de `compute*` não muda quando elas chegam.
   */
  rules?: ExtraRules;
};

function hit(
  id: string,
  extra?: Omit<MomentHit, "id">,
): MomentHit {
  return { id, ...extra };
}

function calendarOf(win: WinEvent, timeZone: string): CalendarDate | null {
  return calendarFromIso(win.wonAt, timeZone);
}

function ruleFirstDrop(ctx: MomentContext): MomentHit | null {
  if (!hasWonAt(ctx.win)) return null;
  const earlier = ctx.userPrefix.some((event) => !sameWin(event, ctx.win));
  if (earlier) return null;
  return hit("first_drop");
}

function ruleStreak(ctx: MomentContext): MomentHit | null {
  const length = consecutiveStreak(ctx.userPrefix, ctx.timeZone);
  if (length < 2) return null;
  const level = length >= 7 ? 7 : length >= 5 ? 5 : length >= 3 ? 3 : 2;
  const rarity: Rarity =
    level === 7
      ? "legendary"
      : level === 5
        ? "epic"
        : level === 3
          ? "rare"
          : "uncommon";
  return hit("streak_daily", { level, rarity, count: length });
}

function comebackGap(ctx: MomentContext, months: number): boolean {
  const day = calendarOf(ctx.win, ctx.timeZone);
  const previous = previousDatedWin(ctx.userPrefix, ctx.win);
  if (!day || !previous) return false;
  const prevDay = calendarOf(previous, ctx.timeZone);
  if (!prevDay) return false;
  return calendarGapAtLeast(prevDay, day, months);
}

function ruleComeback(ctx: MomentContext): MomentHit | null {
  if (!comebackGap(ctx, 1)) return null;
  return hit("comeback");
}

function ruleComeback6(ctx: MomentContext): MomentHit | null {
  if (!comebackGap(ctx, 6)) return null;
  return hit("comeback6");
}

function ruleDoubleDay(ctx: MomentContext): MomentHit | null {
  const day = calendarOf(ctx.win, ctx.timeZone);
  if (!day) return null;
  const key = dateKey(day);
  let count = 0;
  for (const event of ctx.userPrefix) {
    const eventDay = calendarOf(event, ctx.timeZone);
    if (eventDay && dateKey(eventDay) === key) count += 1;
  }
  if (count < 2) return null;
  return hit("double_day", { count });
}

function ruleHatTrick(ctx: MomentContext): MomentHit | null {
  const end = parseInstant(ctx.win.wonAt);
  if (end === null) return null;
  const start = end - DAY_MS;
  let count = 0;
  for (const event of ctx.userPrefix) {
    const instant = parseInstant(event.wonAt);
    if (instant === null) continue;
    if (instant > start && instant <= end) count += 1;
  }
  if (count < 3) return null;
  return hit("hat_trick_24h", { count });
}

function ruleMonthRegular(ctx: MomentContext): MomentHit | null {
  const day = calendarOf(ctx.win, ctx.timeZone);
  if (!day) return null;
  let count = 0;
  for (const event of ctx.userPrefix) {
    const eventDay = calendarOf(event, ctx.timeZone);
    if (eventDay && sameCalendarMonth(eventDay, day)) count += 1;
  }
  if (count < 3) return null;
  return hit("month_regular", { count });
}

function ruleMonthLead(ctx: MomentContext): MomentHit | null {
  const day = calendarOf(ctx.win, ctx.timeZone);
  if (!day) return null;
  const counts = new Map<string, number>();
  for (const event of ctx.historyPrefix) {
    const eventDay = calendarOf(event, ctx.timeZone);
    if (!eventDay || !sameCalendarMonth(eventDay, day)) continue;
    counts.set(event.userKey, (counts.get(event.userKey) ?? 0) + 1);
  }
  const mine = counts.get(ctx.win.userKey) ?? 0;
  if (mine < 2) return null;
  for (const [userKey, count] of counts) {
    if (userKey !== ctx.win.userKey && count >= mine) return null;
  }
  return hit("month_lead", { count: mine });
}

function ruleDoubleKill(ctx: MomentContext): MomentHit | null {
  let count = 0;
  for (const event of ctx.userPrefix) {
    if (
      event.giveawayId === ctx.win.giveawayId &&
      event.giveawayType === ctx.win.giveawayType
    ) {
      count += 1;
    }
  }
  if (count < 2) return null;
  return hit("double_kill", { count });
}

function ruleLoyal(ctx: MomentContext): MomentHit | null {
  if (ctx.win.giveawayType !== "chat") return null;
  const months = ctx.win.context?.subscriptionMonths;
  if (typeof months !== "number") return null;
  const level = months >= 24 ? 24 : months >= 12 ? 12 : months >= 6 ? 6 : 0;
  if (level === 0) return null;
  const rarity: Rarity =
    level === 24 ? "epic" : level === 12 ? "rare" : "uncommon";
  return hit("loyal_sub", { level, rarity, count: months });
}

function ruleGifted(ctx: MomentContext): MomentHit | null {
  if (ctx.win.giveawayType !== "subscribers") return null;
  if (ctx.win.context?.isGift !== true) return null;
  return hit("gifted_sub");
}

export const builtinMomentRules: Record<string, MomentRule> = {
  first_drop: ruleFirstDrop,
  streak_daily: ruleStreak,
  comeback: ruleComeback,
  comeback6: ruleComeback6,
  double_day: ruleDoubleDay,
  hat_trick_24h: ruleHatTrick,
  month_regular: ruleMonthRegular,
  month_lead: ruleMonthLead,
  double_kill: ruleDoubleKill,
  loyal_sub: ruleLoyal,
  gifted_sub: ruleGifted,
};

export function collapseFamilies(awards: readonly BadgeAward[]): BadgeAward[] {
  const best = new Map<string, BadgeAward>();
  for (const award of awards) {
    const key = `${award.kind}:${award.userKey}:${award.family}`;
    const current = best.get(key);
    if (!current || award.level > current.level) best.set(key, award);
  }
  return [...best.values()];
}

function toMomentAward(
  moment: MomentHit,
  win: WinEvent,
  preview: boolean,
): BadgeAward | null {
  const item = getCatalogItem(moment.id);
  if (!item) return null;
  return {
    id: item.id,
    family: item.family,
    kind: item.kind,
    rarity: moment.rarity ?? item.rarity,
    level: moment.level ?? item.level,
    catalogOrder: item.order,
    userKey: win.userKey,
    newlyUnlocked: false,
    highlightEligible: false,
    preview,
    count: moment.count,
    win: winRef(win),
  };
}

function prefixUntil(
  ordered: readonly WinEvent[],
  target: WinEvent,
): { userPrefix: WinEvent[]; historyPrefix: WinEvent[] } | null {
  const historyPrefix = ordered.filter((event) => compareWins(event, target) <= 0);
  const matched = historyPrefix.some((event) => sameWin(event, target));
  if (!matched) return null;
  const userPrefix = historyPrefix.filter(
    (event) => event.userKey === target.userKey,
  );
  return { userPrefix, historyPrefix };
}

export function resolveHistory(
  provider: WinnerHistoryProvider,
  clock: EngineClock,
  options?: ComputeOptions,
): { wins: WinEvent[]; preview?: WinEvent } {
  if (!options?.preview) return { wins: loadWins(provider) };
  const preview = toPreview(options.preview, clock.now);
  return { wins: loadWins(provider, preview), preview };
}

export function computeMomentBadges(
  provider: WinnerHistoryProvider,
  win: WinEvent,
  clock: EngineClock,
  options?: ComputeOptions,
): BadgeAward[] {
  const previewTarget =
    options?.preview && sameWin(options.preview, win)
      ? toPreview(win, clock.now)
      : win.preview
        ? toPreview(win, clock.now)
        : undefined;
  const { wins } = resolveHistory(
    provider,
    clock,
    previewTarget ? { ...options, preview: previewTarget } : options,
  );
  const target = previewTarget ?? win;
  const ordered = sortWins(wins);
  const prefix = prefixUntil(ordered, target);
  if (!prefix) return [];
  const ctx: MomentContext = {
    win: target,
    userPrefix: prefix.userPrefix,
    historyPrefix: prefix.historyPrefix,
    timeZone: clock.timeZone,
  };
  const awards: BadgeAward[] = [];
  const ids = new Set<string>([
    ...Object.keys(builtinMomentRules),
    ...Object.keys(options?.rules?.moment ?? {}),
  ]);
  for (const id of ids) {
    const rule = options?.rules?.moment?.[id] ?? builtinMomentRules[id];
    if (!rule) continue;
    const moment = rule(ctx);
    if (!moment) continue;
    const award = toMomentAward(moment, target, Boolean(previewTarget));
    if (award) awards.push(award);
  }
  return collapseFamilies(awards);
}
