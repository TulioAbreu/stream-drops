/**
 * Selos, conquistas e estatísticas dos vencedores.
 *
 * O motor (`compute*`, `selectForDisplay`) continua puro:
 * não lê nem grava IndexedDB, localStorage ou rede.
 * `now` e `timeZone` são sempre injetados.
 *
 * A S2 acrescenta o provider IndexedDB, o índice em memória
 * e o estado de prontidão. A S11 troca só a origem da leitura
 * (`winner-events`), sem mudar a assinatura de `compute*`.
 * Azarão, Fim da seca, Última hora e Carrasco entram por
 * `ComputeOptions.rules`.
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

export type { WinnerIndex } from "./win-index";
export {
  createWinnerIndex,
  createWinnerIndexFromSource,
} from "./win-index";

export {
  buildWinnerIndexFromDatabase,
  readWinnerHistorySource,
  WINNER_HISTORY_STORES,
} from "./indexed-db-source";

export type {
  WinnerIndexLoadOptions,
  WinnerIndexStatus,
} from "./readiness";
export {
  EMPTY_CARD_SELECTION,
  noteGiveawayConfirmed,
  noteGiveawayHardDeleted,
  noteGiveawaySoftDeleted,
  noteGiveawayWinnerRemoved,
  readCardBadges,
  readConfirmedBadges,
  resetWinnerIndexSession,
  startWinnerIndex,
  useCardBadges,
  useConfirmedBadges,
  useWinnerIndexStore,
} from "./readiness";

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
