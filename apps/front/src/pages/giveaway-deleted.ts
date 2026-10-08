import type { GiveawayWriteResult } from "@/database/giveaway-deletion";
import i18n from "@/i18n/i18n";
import { toast } from "sonner";

/**
 * Update recusado porque o sorteio já foi soft-deleted.
 * Avisa e sai da tela, no lugar do toast de sucesso.
 */
export function redirectIfGiveawayDeleted(
  result: GiveawayWriteResult,
  navigate: (to: string) => void,
  to: string,
): boolean {
  if (result !== "deleted") return false;
  toast.info(i18n.t("GIVEAWAY_DELETED_TOAST"));
  navigate(to);
  return true;
}
