/**
 * Motor puro de selos, conquistas e estatísticas dos vencedores (S1).
 *
 * Não lê nem grava IndexedDB, localStorage, sessionStorage ou rede.
 * `now` e `timeZone` são sempre injetados.
 *
 * A S2 implementa `WinnerHistoryProvider` sobre o IndexedDB.
 * A S11 pode trocar a origem para `winner-events`.
 * Azarão, Fim da seca, Última hora e Carrasco entram por
 * `ComputeOptions.rules`, sem mudar a assinatura de `compute*`.
 */

export type {
  AchievementContext,
  AchievementHit,
  AchievementRule,
  ComputeOptions,
  ExtraRules,
  MomentContext,
  MomentHit,
  MomentRule,
} from "./moment-badges";
export {
  builtinMomentRules,
  collapseFamilies,
  computeMomentBadges,
  resolveHistory,
} from "./moment-badges";

export { computeAchievements } from "./achievements";

export type {
  ChannelStats,
  RankedWinner,
  StatsResult,
  ViewerStats,
} from "./stats";
export { computeStats } from "./stats";

export type { DisplaySelection } from "./select-for-display";
export {
  CARD_LIMIT,
  collectWinAwards,
  compareAwards,
  LOG_LIMIT,
  selectForDisplay,
} from "./select-for-display";

export type { CatalogItem, CatalogPhase } from "./catalog";
export { BADGE_CATALOG, getCatalogItem, rarityRank } from "./catalog";

export type { WinnerHistoryProvider } from "./history";
export {
  createMemoryHistoryProvider,
  loadWins,
  toPreview,
} from "./history";

export { normalizeWinnerHistory } from "./normalize";
export type { WinnerHistorySource } from "./normalize";

export {
  compareWins,
  hasWonAt,
  isCountedWin,
  makeUserKey,
  sameWin,
  sortWins,
  winRef,
} from "./order";

export {
  addCalendarDays,
  addCalendarMonths,
  calendarFromIso,
  dateKey,
  localDateTimeToIso,
  monthCloseIso,
  parseInstant,
} from "./datetime";

export type {
  BadgeAward,
  BadgeKind,
  CalendarDate,
  EngineClock,
  GiveawayType,
  Rarity,
  SubscriptionTier,
  WinContext,
  WinEvent,
  WinRef,
} from "./types";
