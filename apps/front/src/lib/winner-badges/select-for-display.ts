import { rarityRank } from "./catalog";
import type { WinnerHistoryProvider } from "./history";
import {
  collapseFamilies,
  computeMomentBadges,
  type ComputeOptions,
} from "./moment-badges";
import { computeAchievements } from "./achievements";
import { sameWin, winRef } from "./order";
import type { BadgeAward, EngineClock, WinEvent } from "./types";

export const CARD_LIMIT = 3;
export const LOG_LIMIT = 2;

export type DisplaySelection = {
  /** Até 3 selos, já na ordem de exibição. */
  card: BadgeAward[];
  /** N de "+N" no card. */
  cardOverflow: number;
  /** Até 2 ícones no log. */
  log: BadgeAward[];
  /**
   * Sobras do log. O Designer deixou o "+N" do log em aberto;
   * o CA17 exige que os ícones visíveis sejam 2.
   */
  logOverflow: number;
  tooltip: BadgeAward[];
  /**
   * No máximo um destaque. Rei do mês nunca entra (D13).
   * `null` quando nenhuma conquista permanente fecha nesta vitória.
   */
  highlight: BadgeAward | null;
};

/** Raridade desc → recém-desbloqueada → ordem do catálogo. */
export function compareAwards(a: BadgeAward, b: BadgeAward): number {
  const byRarity = rarityRank(b.rarity) - rarityRank(a.rarity);
  if (byRarity !== 0) return byRarity;
  const byFresh = Number(b.newlyUnlocked) - Number(a.newlyUnlocked);
  if (byFresh !== 0) return byFresh;
  if (a.catalogOrder !== b.catalogOrder) {
    return a.catalogOrder - b.catalogOrder;
  }
  if (a.id === b.id) return 0;
  return a.id < b.id ? -1 : 1;
}

function withoutKingHighlight(award: BadgeAward): BadgeAward {
  if (award.id !== "month_king") return award;
  return { ...award, newlyUnlocked: false, highlightEligible: false };
}

export function selectForDisplay(
  awards: readonly BadgeAward[],
): DisplaySelection {
  const tooltip = collapseFamilies(awards.map(withoutKingHighlight)).sort(
    compareAwards,
  );
  const highlight =
    tooltip.find(
      (award) =>
        award.kind === "achievement" &&
        award.newlyUnlocked &&
        award.highlightEligible,
    ) ?? null;
  return {
    card: tooltip.slice(0, CARD_LIMIT),
    cardOverflow: Math.max(0, tooltip.length - CARD_LIMIT),
    log: tooltip.slice(0, LOG_LIMIT),
    logOverflow: Math.max(0, tooltip.length - LOG_LIMIT),
    tooltip,
    highlight,
  };
}

/**
 * Selos de momento da vitória + conquistas que ela completou.
 * Rei do mês não entra: não nasce de uma vitória (D13).
 */
export function collectWinAwards(
  provider: WinnerHistoryProvider,
  win: WinEvent,
  clock: EngineClock,
  options?: ComputeOptions,
): BadgeAward[] {
  const preview = options?.preview ?? (win.preview ? win : undefined);
  const resolved = preview ? { ...options, preview } : options;
  const moments = computeMomentBadges(provider, win, clock, resolved);
  const achievements = computeAchievements(provider, clock, resolved);
  const ref = winRef(win);
  const unlockedHere = achievements
    .filter(
      (award) =>
        award.id !== "month_king" &&
        award.win !== undefined &&
        sameWin(award.win, ref),
    )
    .map((award) => ({
      ...award,
      newlyUnlocked: true,
      highlightEligible: true,
    }));
  return [...moments, ...unlockedHere];
}
