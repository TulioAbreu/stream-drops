import { AlertCircle } from "lucide-react";
import { useTranslation } from "@/i18n";

interface ChannelPointsAccessBannerProps {
  className?: string;
}

export function ChannelPointsAccessBanner({
  className,
}: ChannelPointsAccessBannerProps) {
  const { t } = useTranslation();

  return (
    <div
      role="alert"
      className={`flex gap-3 rounded-lg border border-destructive/40 bg-destructive/10 p-4 text-sm ${className ?? ""}`}
    >
      <AlertCircle className="h-5 w-5 shrink-0 text-destructive mt-0.5" />
      <div className="flex flex-col gap-1">
        <p className="font-medium text-destructive">
          {t("CHANNEL_POINTS_GIVEAWAY_ACCESS_DENIED_TITLE")}
        </p>
        <p className="text-muted-foreground">
          {t("CHANNEL_POINTS_GIVEAWAY_ACCESS_DENIED_DESCRIPTION")}
        </p>
      </div>
    </div>
  );
}
