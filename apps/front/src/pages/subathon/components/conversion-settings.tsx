import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { useTranslation } from "@/i18n";
import type {
  ConversionRule,
  ConversionUnit,
  TwitchSubTier,
} from "@stream-drops/subathon-protocol";
import {
  TWITCH_SUB_TIERS,
  giftUnitForTier,
  subUnitForTier,
} from "@stream-drops/subathon-protocol";
import {
  CircleDollarSign,
  Gem,
  Gift,
  Loader2,
  Star,
} from "lucide-react";
import { TimeInput } from "./time-input";

const TIER_LABEL_KEYS: Record<TwitchSubTier, string> = {
  "1000": "SUBATHON_TIER_1",
  "2000": "SUBATHON_TIER_2",
  "3000": "SUBATHON_TIER_3",
};

interface ConversionSettingsProps {
  rules: ConversionRule[];
  dirty: boolean;
  saving: boolean;
  disabled: boolean;
  onChange: (rules: ConversionRule[]) => void;
  onSave: () => void;
}

function updateRuleMs(
  rules: ConversionRule[],
  unit: ConversionUnit,
  msPerUnit: number,
): ConversionRule[] {
  return rules.map((rule) =>
    rule.unit === unit ? { ...rule, msPerUnit } : rule,
  );
}

function ruleMs(rules: ConversionRule[], unit: ConversionUnit): number {
  return rules.find((rule) => rule.unit === unit)?.msPerUnit ?? 0;
}

export function ConversionSettings({
  rules,
  dirty,
  saving,
  disabled,
  onChange,
  onSave,
}: ConversionSettingsProps) {
  const { t } = useTranslation();

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("SUBATHON_CONVERSION_TITLE")}</CardTitle>
        <CardDescription>
          {t("SUBATHON_CONVERSION_DESCRIPTION")}
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-6">
        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-2 text-sm font-medium">
            <CircleDollarSign className="size-4" aria-hidden="true" />
            {t("SUBATHON_CONVERSION_RULE", {
              unitLabel: t("SUBATHON_UNIT_BRL"),
            })}
          </div>
          <TimeInput
            valueMs={ruleMs(rules, "brl")}
            disabled={disabled}
            onChangeMs={(ms) => onChange(updateRuleMs(rules, "brl", ms))}
          />
        </div>

        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-2 text-sm font-medium">
            <Gem className="size-4" aria-hidden="true" />
            {t("SUBATHON_CONVERSION_RULE", {
              unitLabel: t("SUBATHON_UNIT_BITS"),
            })}
          </div>
          <TimeInput
            valueMs={ruleMs(rules, "bits")}
            disabled={disabled}
            onChangeMs={(ms) => onChange(updateRuleMs(rules, "bits", ms))}
          />
        </div>

        <div className="flex flex-col gap-3">
          <div className="flex items-center gap-2 text-sm font-medium">
            <Star className="size-4" aria-hidden="true" />
            {t("SUBATHON_UNIT_SUB")}
          </div>
          <p className="text-sm text-muted-foreground">
            {t("SUBATHON_CONVERSION_TIER_HINT")}
          </p>
          {TWITCH_SUB_TIERS.map((tier) => {
            const unit = subUnitForTier(tier);
            return (
              <div key={unit} className="flex flex-col gap-2 pl-1">
                <div className="text-sm font-medium">
                  {t("SUBATHON_CONVERSION_RULE", {
                    unitLabel: t(TIER_LABEL_KEYS[tier]),
                  })}
                </div>
                <TimeInput
                  valueMs={ruleMs(rules, unit)}
                  disabled={disabled}
                  onChangeMs={(ms) =>
                    onChange(updateRuleMs(rules, unit, ms))
                  }
                />
              </div>
            );
          })}
        </div>

        <div className="flex flex-col gap-3">
          <div className="flex items-center gap-2 text-sm font-medium">
            <Gift className="size-4" aria-hidden="true" />
            {t("SUBATHON_UNIT_SUB_GIFT")}
          </div>
          <p className="text-sm text-muted-foreground">
            {t("SUBATHON_CONVERSION_TIER_HINT")}
          </p>
          {TWITCH_SUB_TIERS.map((tier) => {
            const unit = giftUnitForTier(tier);
            return (
              <div key={unit} className="flex flex-col gap-2 pl-1">
                <div className="text-sm font-medium">
                  {t("SUBATHON_CONVERSION_RULE", {
                    unitLabel: t(TIER_LABEL_KEYS[tier]),
                  })}
                </div>
                <TimeInput
                  valueMs={ruleMs(rules, unit)}
                  disabled={disabled}
                  onChangeMs={(ms) =>
                    onChange(updateRuleMs(rules, unit, ms))
                  }
                />
              </div>
            );
          })}
        </div>

        <Button onClick={onSave} disabled={disabled || !dirty || saving}>
          {saving ? <Loader2 className="size-4 animate-spin" /> : null}
          {t("SUBATHON_SAVE")}
        </Button>
      </CardContent>
    </Card>
  );
}
