import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useTranslation } from "@/i18n";
import { CheckCircle2, Loader2, WifiOff } from "lucide-react";
import { useSubathon } from "../hooks/use-subathon";

export function ConnectionBanner() {
  const { t } = useTranslation();
  const subathon = useSubathon();

  if (subathon.connected) {
    return (
      <Badge
        role="status"
        aria-live="polite"
        variant="outline"
        className="gap-1.5 border-green-500/40 bg-green-500/10 px-2.5 py-1 text-green-600 dark:text-green-400"
      >
        <CheckCircle2 className="size-3.5" aria-hidden="true" />
        {t("SUBATHON_STATUS_CONNECTED")}
      </Badge>
    );
  }

  if (subathon.connecting) {
    return (
      <Badge
        role="status"
        aria-live="polite"
        variant="outline"
        className="gap-1.5 border-amber-500/40 bg-amber-500/10 px-2.5 py-1 text-amber-700 dark:text-amber-300"
      >
        <Loader2 className="size-3.5 animate-spin" aria-hidden="true" />
        {t("SUBATHON_CONNECT_ATTEMPT", {
          attempt: subathon.attempt + 1,
        })}
      </Badge>
    );
  }

  return (
    <div
      role="status"
      aria-live="polite"
      className="flex flex-wrap items-center gap-2"
    >
      <Badge
        variant="outline"
        className="gap-1.5 border-red-500/40 bg-red-500/10 px-2.5 py-1 text-red-600 dark:text-red-400"
      >
        <WifiOff className="size-3.5" aria-hidden="true" />
        {t("SUBATHON_SERVER_DISCONNECTED")}
      </Badge>
      <Button
        size="sm"
        variant="secondary"
        onClick={() => void subathon.connect()}
      >
        {t("SUBATHON_CONNECT_RETRY_BUTTON")}
      </Button>
    </div>
  );
}
