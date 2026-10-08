import type { ChatGiveawayWinnerContext } from "@/database/ChatGiveaway";
import type { ChatParticipant } from "./types";

const TIERS = new Set([1000, 2000, 3000]);

/**
 * Copia meses e tier do participante no momento da confirmação.
 * Campo ausente, nulo ou inválido não entra. Não preenche padrão.
 */
export function chatWinnerContextFromParticipant(
  participant: Pick<ChatParticipant, "subscriptionMonths" | "tier"> | null | undefined,
): ChatGiveawayWinnerContext {
  const context: ChatGiveawayWinnerContext = {};
  if (!participant) return context;

  const months = participant.subscriptionMonths;
  if (typeof months === "number" && Number.isFinite(months)) {
    context.subscriptionMonths = months;
  }

  const tier = participant.tier;
  if (typeof tier === "number" && TIERS.has(tier)) {
    context.tier = tier as 1000 | 2000 | 3000;
  }

  return context;
}
