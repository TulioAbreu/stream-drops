import { Badge } from "@/components/ui/badge";
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

interface TwitchIntegrationCardProps {
  enabled: boolean;
  connected: boolean;
  serverConnected: boolean;
  onToggle: (enabled: boolean) => void;
}

export function TwitchIntegrationCard({
  enabled,
  connected,
  serverConnected,
  onToggle,
}: TwitchIntegrationCardProps) {
  const { t } = useTranslation();

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
        <div className="flex items-center justify-between gap-4">
          <Label htmlFor="subathon-eventsub">
            {t("SUBATHON_EVENTSUB_TOGGLE")}
          </Label>
          <Switch
            id="subathon-eventsub"
            checked={enabled}
            disabled={!serverConnected}
            onCheckedChange={onToggle}
          />
        </div>
      </CardContent>
    </Card>
  );
}
