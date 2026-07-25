import { useEffect, useState } from "react";
import { AlertCircle } from "lucide-react";
import { useTranslation } from "@/i18n";
import { Button } from "@/components/ui/button";
import {
  channelPointsAccessBlockI18nKeys,
  type ChannelPointsAccessBlockReason,
} from "@/lib/channel-points-access";
import {
  isTwitchStubMode,
  openTwitchLoginPopup,
  STUB_ACCESS_TOKEN,
} from "@/lib/twitch-oauth";
import { useLoginStore } from "@/storage/login";
import { useQueryClient } from "@tanstack/react-query";

interface ChannelPointsAccessBannerProps {
  reason: ChannelPointsAccessBlockReason;
  className?: string;
}

export function ChannelPointsAccessBanner({
  reason,
  className,
}: ChannelPointsAccessBannerProps) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const setTwitchAccessToken = useLoginStore(
    (state) => state.setTwitchAccessToken
  );
  const setSessionExpired = useLoginStore((state) => state.setSessionExpired);
  const [isReauthing, setIsReauthing] = useState(false);
  const stubMode = isTwitchStubMode();
  const keys = channelPointsAccessBlockI18nKeys(reason);

  useEffect(() => {
    if (reason !== "missing_scope" || stubMode) return;

    function handleMessage(event: MessageEvent) {
      if (event.origin !== window.location.origin) return;
      if (event.data?.type === "twitch-auth" && event.data.accessToken) {
        setTwitchAccessToken(event.data.accessToken);
        setIsReauthing(false);
      }
    }

    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  }, [reason, stubMode, setTwitchAccessToken]);

  const handleReconnect = async () => {
    setIsReauthing(true);
    if (stubMode) {
      setTwitchAccessToken(null);
      await queryClient.resetQueries({ queryKey: ["twitchUser"] });
      setSessionExpired(false);
      setTwitchAccessToken(STUB_ACCESS_TOKEN);
      setIsReauthing(false);
      return;
    }
    // force_verify: sem isso a Twitch reaproveita o grant antigo e fecha o popup
    // sem pedir os scopes novos (ex.: channel:manage:redemptions).
    openTwitchLoginPopup({ forceVerify: true });
  };

  return (
    <div
      role="alert"
      className={`flex gap-3 rounded-lg border border-destructive/40 bg-destructive/10 p-4 text-sm ${className ?? ""}`}
    >
      <AlertCircle className="h-5 w-5 shrink-0 text-destructive mt-0.5" />
      <div className="flex flex-col gap-3 flex-1">
        <div className="flex flex-col gap-1">
          <p className="font-medium text-destructive">{t(keys.title)}</p>
          <p className="text-muted-foreground">
            {stubMode && reason === "missing_scope"
              ? t("CHANNEL_POINTS_GIVEAWAY_MISSING_SCOPE_DESCRIPTION_STUB")
              : t(keys.description)}
          </p>
        </div>
        {reason === "missing_scope" && (
          <div>
            <Button
              type="button"
              size="sm"
              onClick={handleReconnect}
              disabled={isReauthing}
            >
              {isReauthing
                ? t("CHANNEL_POINTS_GIVEAWAY_RECONNECTING")
                : stubMode
                  ? t("LOGIN_BUTTON_TWITCH_STUB")
                  : t("CHANNEL_POINTS_GIVEAWAY_RECONNECT_BUTTON")}
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
