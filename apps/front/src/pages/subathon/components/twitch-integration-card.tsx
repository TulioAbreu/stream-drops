import { useEffect, useState } from "react";
import { AlertCircle } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { useTranslation } from "@/i18n";
import { getSubathonTwitchAccessBlock } from "@/lib/subathon-twitch-access";
import {
  isTwitchStubMode,
  openTwitchLoginPopup,
  STUB_ACCESS_TOKEN,
} from "@/lib/twitch-oauth";
import { useLoginStore } from "@/storage/login";

interface TwitchIntegrationCardProps {
  enabled: boolean;
  connected: boolean;
  serverConnected: boolean;
  scopes?: string[] | null;
  onToggle: (enabled: boolean) => void;
}

export function TwitchIntegrationCard({
  enabled,
  connected,
  serverConnected,
  scopes,
  onToggle,
}: TwitchIntegrationCardProps) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const setTwitchAccessToken = useLoginStore(
    (state) => state.setTwitchAccessToken,
  );
  const setSessionExpired = useLoginStore((state) => state.setSessionExpired);
  const [isReauthing, setIsReauthing] = useState(false);
  const [pendingEnable, setPendingEnable] = useState(false);
  const stubMode = isTwitchStubMode();
  const missingScope = getSubathonTwitchAccessBlock({ scopes }) === "missing_scope";

  useEffect(() => {
    if (!pendingEnable || missingScope) return;

    onToggle(true);
    setPendingEnable(false);
    setIsReauthing(false);
  }, [pendingEnable, missingScope, onToggle]);

  useEffect(() => {
    if (!pendingEnable || stubMode) return;

    function handleMessage(event: MessageEvent) {
      if (event.origin !== window.location.origin) return;
      if (event.data?.type === "twitch-auth" && event.data.accessToken) {
        setTwitchAccessToken(event.data.accessToken);
        void queryClient.invalidateQueries({ queryKey: ["twitchUser"] });
      }
    }

    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  }, [pendingEnable, stubMode, setTwitchAccessToken, queryClient]);

  const handleReconnect = async () => {
    setIsReauthing(true);
    setPendingEnable(true);
    if (stubMode) {
      setTwitchAccessToken(null);
      await queryClient.resetQueries({ queryKey: ["twitchUser"] });
      setSessionExpired(false);
      setTwitchAccessToken(STUB_ACCESS_TOKEN);
      setIsReauthing(false);
      return;
    }
    // force_verify: Twitch reuses the old grant without new scopes otherwise.
    openTwitchLoginPopup({ forceVerify: true });
  };

  const handleToggle = (next: boolean) => {
    if (!next) {
      setPendingEnable(false);
      onToggle(false);
      return;
    }

    if (missingScope) {
      setPendingEnable(true);
      return;
    }

    onToggle(true);
  };

  const statusBadge = (() => {
    if (!enabled) {
      return (
        <Badge variant="secondary">{t("SUBATHON_EVENTSUB_STATUS_OFF")}</Badge>
      );
    }

    if (connected) {
      return (
        <Badge className="border-green-500/40 bg-green-500/10 text-green-600 dark:text-green-400">
          {t("SUBATHON_EVENTSUB_STATUS_ON")}
        </Badge>
      );
    }

    return (
      <Badge className="border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-300">
        {t("SUBATHON_EVENTSUB_STATUS_PENDING")}
      </Badge>
    );
  })();

  const showScopeBanner = missingScope && (pendingEnable || enabled);

  return (
    <Card className="bg-muted/30">
      <CardHeader>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <CardTitle>{t("SUBATHON_EVENTSUB_TITLE")}</CardTitle>
            <CardDescription>
              {t("SUBATHON_EVENTSUB_DESCRIPTION")}
            </CardDescription>
          </div>
          {statusBadge}
        </div>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <p className="text-sm text-muted-foreground">
          {t("SUBATHON_EVENTSUB_HINT")}
        </p>

        {showScopeBanner && (
          <div
            role="alert"
            className="flex gap-3 rounded-lg border border-destructive/40 bg-destructive/10 p-4 text-sm"
          >
            <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-destructive" />
            <div className="flex flex-1 flex-col gap-3">
              <div className="flex flex-col gap-1">
                <p className="font-medium text-destructive">
                  {t("SUBATHON_EVENTSUB_MISSING_SCOPE_TITLE")}
                </p>
                <p className="text-muted-foreground">
                  {stubMode
                    ? t("SUBATHON_EVENTSUB_MISSING_SCOPE_DESCRIPTION_STUB")
                    : t("SUBATHON_EVENTSUB_MISSING_SCOPE_DESCRIPTION")}
                </p>
              </div>
              <Button
                type="button"
                size="sm"
                className="w-fit"
                disabled={isReauthing}
                onClick={() => void handleReconnect()}
              >
                {isReauthing
                  ? t("SUBATHON_EVENTSUB_REAUTH_PENDING")
                  : t("SUBATHON_EVENTSUB_REAUTH")}
              </Button>
            </div>
          </div>
        )}

        <div className="flex items-center justify-between gap-4">
          <Label htmlFor="subathon-eventsub">
            {t("SUBATHON_EVENTSUB_TOGGLE")}
          </Label>
          <Switch
            id="subathon-eventsub"
            checked={enabled || pendingEnable}
            disabled={!serverConnected}
            onCheckedChange={handleToggle}
          />
        </div>
      </CardContent>
    </Card>
  );
}
