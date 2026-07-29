import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { useTranslation } from "@/i18n";
import type { ConversionRule, ConversionUnit } from "@stream-drops/subathon-protocol";
import {
  CircleDollarSign,
  Gem,
  Gift,
  Loader2,
  Star,
} from "lucide-react";
import { TimeInput } from "./time-input";

const UNIT_ICONS: Record<
  ConversionUnit,
  typeof CircleDollarSign
> = {
  brl: CircleDollarSign,
  bits: Gem,
  sub: Star,
  sub_gift: Gift,
};

const UNIT_LABEL_KEYS: Record<ConversionUnit, string> = {
  brl: "SUBATHON_UNIT_BRL",
  bits: "SUBATHON_UNIT_BITS",
  sub: "SUBATHON_UNIT_SUB",
  sub_gift: "SUBATHON_UNIT_SUB_GIFT",
};

interface ConversionSettingsProps {
  rules: ConversionRule[];
  dirty: boolean;
  saving: boolean;
  disabled: boolean;
  onChange: (rules: ConversionRule[]) => void;
  onSave: () => void;
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
      <CardContent className="flex flex-col gap-4">
        {rules.map((rule, index) => {
          const Icon = UNIT_ICONS[rule.unit];

          return (
            <div key={rule.unit} className="flex flex-col gap-2">
              <div className="flex items-center gap-2 text-sm font-medium">
                <Icon className="size-4" aria-hidden="true" />
                {t("SUBATHON_CONVERSION_RULE", {
                  unitLabel: t(UNIT_LABEL_KEYS[rule.unit]),
                })}
              </div>
              <TimeInput
                valueMs={rule.msPerUnit}
                disabled={disabled}
                onChangeMs={(ms) => {
                  const next = [...rules];
                  next[index] = { ...rule, msPerUnit: ms };
                  onChange(next);
                }}
              />
            </div>
          );
        })}
        <Button onClick={onSave} disabled={disabled || !dirty || saving}>
          {saving ? <Loader2 className="size-4 animate-spin" /> : null}
          {t("SUBATHON_SAVE")}
        </Button>
      </CardContent>
    </Card>
  );
}
