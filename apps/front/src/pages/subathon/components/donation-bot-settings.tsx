import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useTranslation } from "@/i18n";
import {
  matchDonationMessage,
  type DonationBotConfig,
} from "@stream-drops/subathon-protocol";
import { CircleHelp, Loader2, Plus, Trash2 } from "lucide-react";
import { useMemo, useState } from "react";
import { formatHumanDuration } from "../utils";

interface DonationBotSettingsProps {
  config: DonationBotConfig;
  brlMsPerUnit: number;
  dirty: boolean;
  saving: boolean;
  disabled: boolean;
  chatConnected: boolean;
  onChange: (config: DonationBotConfig) => void;
  onSave: () => void;
}

export function DonationBotSettings({
  config,
  brlMsPerUnit,
  dirty,
  saving,
  disabled,
  chatConnected,
  onChange,
  onSave,
}: DonationBotSettingsProps) {
  const { t } = useTranslation();
  const [testMessage, setTestMessage] = useState("");

  const testResult = useMemo(() => {
    const trimmed = testMessage.trim();
    if (!trimmed) {
      return null;
    }

    const matched = matchDonationMessage(config.templates, trimmed);
    if (!matched) {
      return { ok: false as const };
    }

    const deltaMs = Math.round(brlMsPerUnit * matched.amount);
    return {
      ok: true as const,
      user: matched.user,
      amount: matched.amount,
      deltaMs,
    };
  }, [testMessage, config.templates, brlMsPerUnit]);

  const updateTemplate = (index: number, value: string) => {
    const templates = [...config.templates];
    templates[index] = value;
    onChange({ ...config, templates });
  };

  const removeTemplate = (index: number) => {
    onChange({
      ...config,
      templates: config.templates.filter((_, i) => i !== index),
    });
  };

  const addTemplate = () => {
    onChange({
      ...config,
      templates: [
        ...config.templates,
        "{user} fez uma doação no valor de R${amount}",
      ],
    });
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex flex-col gap-1.5">
            <div className="flex items-center gap-2">
              <CardTitle>{t("SUBATHON_DONATION_BOT_TITLE")}</CardTitle>
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button
                      type="button"
                      className="text-muted-foreground hover:text-foreground inline-flex size-6 items-center justify-center rounded-full"
                      aria-label={t("SUBATHON_DONATION_BOT_HELP_ARIA")}
                    >
                      <CircleHelp className="size-4" />
                    </button>
                  </TooltipTrigger>
                  <TooltipContent className="max-w-sm space-y-2 p-3 text-left">
                    <p className="font-medium">
                      {t("SUBATHON_DONATION_BOT_HELP_TITLE")}
                    </p>
                    <p>{t("SUBATHON_DONATION_BOT_HELP_PLACEHOLDERS")}</p>
                    <p>{t("SUBATHON_DONATION_BOT_HELP_AMOUNTS")}</p>
                    <p className="text-muted-foreground font-mono text-xs">
                      {t("SUBATHON_DONATION_BOT_HELP_EXAMPLE")}
                    </p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>
            <CardDescription>
              {t("SUBATHON_DONATION_BOT_DESCRIPTION")}
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {!chatConnected && (
          <p className="text-amber-700 dark:text-amber-300 text-sm">
            {t("SUBATHON_DONATION_BOT_CHAT_OFF_HINT")}
          </p>
        )}

        <div className="flex items-center justify-between gap-4">
          <Label htmlFor="donation-bot-enabled">
            {t("SUBATHON_DONATION_BOT_TOGGLE")}
          </Label>
          <Switch
            id="donation-bot-enabled"
            checked={config.enabled}
            disabled={disabled}
            onCheckedChange={(enabled) => onChange({ ...config, enabled })}
          />
        </div>

        <div className="flex flex-col gap-2">
          <Label htmlFor="donation-bot-username">
            {t("SUBATHON_DONATION_BOT_USERNAME")}
          </Label>
          <Input
            id="donation-bot-username"
            value={config.botUsername}
            disabled={disabled}
            placeholder={t("SUBATHON_DONATION_BOT_USERNAME_PLACEHOLDER")}
            onChange={(event) =>
              onChange({
                ...config,
                botUsername: event.target.value,
              })
            }
          />
        </div>

        <div className="flex flex-col gap-3">
          <Label>{t("SUBATHON_DONATION_BOT_TEMPLATES")}</Label>
          {config.templates.length === 0 ? (
            <p className="text-muted-foreground text-sm">
              {t("SUBATHON_DONATION_BOT_TEMPLATES_EMPTY")}
            </p>
          ) : null}
          {config.templates.map((template, index) => (
            <div key={index} className="flex gap-2">
              <Input
                value={template}
                disabled={disabled}
                placeholder="{user} fez uma doação no valor de R${amount}"
                onChange={(event) =>
                  updateTemplate(index, event.target.value)
                }
              />
              <Button
                type="button"
                variant="outline"
                size="icon"
                disabled={disabled}
                aria-label={t("SUBATHON_DONATION_BOT_REMOVE_TEMPLATE")}
                onClick={() => removeTemplate(index)}
              >
                <Trash2 className="size-4" />
              </Button>
            </div>
          ))}
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="w-fit"
            disabled={disabled}
            onClick={addTemplate}
          >
            <Plus className="size-4" />
            {t("SUBATHON_DONATION_BOT_ADD_TEMPLATE")}
          </Button>
        </div>

        <div className="flex flex-col gap-2 border-t pt-4">
          <Label htmlFor="donation-bot-test">
            {t("SUBATHON_DONATION_BOT_TEST_TITLE")}
          </Label>
          <Textarea
            id="donation-bot-test"
            value={testMessage}
            rows={3}
            placeholder={t("SUBATHON_DONATION_BOT_TEST_PLACEHOLDER")}
            onChange={(event) => setTestMessage(event.target.value)}
          />
          {testResult === null ? null : testResult.ok ? (
            <p className="text-sm text-green-700 dark:text-green-400">
              {t("SUBATHON_DONATION_BOT_TEST_OK", {
                user: testResult.user,
                amount: testResult.amount.toLocaleString("pt-BR", {
                  style: "currency",
                  currency: "BRL",
                }),
                duration: formatHumanDuration(testResult.deltaMs),
              })}
            </p>
          ) : (
            <p className="text-muted-foreground text-sm">
              {t("SUBATHON_DONATION_BOT_TEST_FAIL")}
            </p>
          )}
        </div>

        <Button onClick={onSave} disabled={disabled || !dirty || saving}>
          {saving ? <Loader2 className="size-4 animate-spin" /> : null}
          {t("SUBATHON_SAVE")}
        </Button>
      </CardContent>
    </Card>
  );
}
