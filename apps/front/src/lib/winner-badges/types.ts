/**
 * Motor puro de selos, conquistas e estatísticas.
 * Não lê nem grava IndexedDB, localStorage ou rede.
 * A S2 (IndexedDB) e a S11 (winner-events) só implementam
 * `WinnerHistoryProvider`.
 */

export type GiveawayType = "chat" | "channel-points" | "subscribers";

export type SubscriptionTier = "1000" | "2000" | "3000";

export type Rarity =
  | "common"
  | "uncommon"
  | "rare"
  | "epic"
  | "legendary";

/** Contexto da vitória. Campos ausentes não disparam selo. */
export type WinContext = {
  subscriptionMonths?: number;
  tier?: SubscriptionTier;
  isGift?: boolean;
};

/**
 * Vitória confirmada (ou prévia hipotética).
 * `userKey` é `"<platform>:<userId>"`, com `platform ?? "twitch"`.
 */
export type WinEvent = {
  userKey: string;
  platform: string;
  userId: string;
  giveawayType: GiveawayType;
  giveawayId: string;
  /** Índice original no array `winners`. */
  index: number;
  /** ISO. Ausente em Subscribers legado. */
  wonAt?: string;
  name: string;
  avatar?: string;
  context?: WinContext;
  /**
   * Prévia do pendente. Não faz parte do histórico confirmado.
   * O cálculo usa `wonAt = now` injetado.
   */
  preview?: boolean;
};

export type WinRef = {
  giveawayType: GiveawayType;
  giveawayId: string;
  index: number;
};

export type EngineClock = {
  /** Instante injetado (ISO). O motor não chama `Date.now()`. */
  now: string;
  /** Fuso IANA, por exemplo `America/Sao_Paulo`. */
  timeZone: string;
};

export type BadgeKind = "moment" | "achievement";

export type BadgeAward = {
  id: string;
  family: string;
  kind: BadgeKind;
  rarity: Rarity;
  /** Quanto maior, mais alto na família. Só o maior é exibido. */
  level: number;
  catalogOrder: number;
  userKey: string;
  /**
   * Conquista permanente completada por esta vitória.
   * Rei do mês é sempre `false` (D13).
   */
  newlyUnlocked: boolean;
  /** Pode ser o destaque único "Conquista desbloqueada!". */
  highlightEligible: boolean;
  preview: boolean;
  /** Dias de streak, meses de sub, vitórias no mês, etc. */
  count?: number;
  win?: WinRef;
  /** ISO. No Rei do mês, o fechamento do mês no fuso local. */
  unlockedAt?: string;
  month?: { year: number; month: number };
  shared?: boolean;
  /** Outras pessoas no empate (`tiedCount - 1`). */
  sharedWith?: number;
  /** Índice do título (1 = primeiro mês). O último é o ×N. */
  titleIndex?: number;
};

export type CalendarDate = {
  year: number;
  month: number;
  day: number;
};
