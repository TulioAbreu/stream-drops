import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
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
  Star,
} from "lucide-react";
import { useMemo, useState } from "react";
import { formatHumanDuration } from "../utils";

type CreditFamily = "brl" | "bits" | "sub" | "sub_gift";

const FAMILY_CONFIG: Record<
  CreditFamily,
  {
    icon: typeof CircleDollarSign;
    labelKey: string;
    tooltipKey: string;
    integerOnly: boolean;
  }
> = {
  brl: {
    icon: CircleDollarSign,
    labelKey: "SUBATHON_UNIT_BRL",
    tooltipKey: "SUBATHON_UNIT_BRL_TOOLTIP",
    integerOnly: false,
  },
  bits: {
    icon: Gem,
    labelKey: "SUBATHON_UNIT_BITS",
    tooltipKey: "SUBATHON_UNIT_BITS_TOOLTIP",
    integerOnly: true,
  },
  sub: {
    icon: Star,
    labelKey: "SUBATHON_UNIT_SUB",
    tooltipKey: "SUBATHON_UNIT_SUB_TOOLTIP",
    integerOnly: true,
  },
  sub_gift: {
    icon: Gift,
    labelKey: "SUBATHON_UNIT_SUB_GIFT",
    tooltipKey: "SUBATHON_UNIT_SUB_GIFT_TOOLTIP",
    integerOnly: true,
  },
};

const TIER_LABEL_KEYS: Record<TwitchSubTier, string> = {
  "1000": "SUBATHON_TIER_1",
  "2000": "SUBATHON_TIER_2",
  "3000": "SUBATHON_TIER_3",
};

const FAMILIES: CreditFamily[] = ["brl", "bits", "sub", "sub_gift"];

function resolveUnit(
  family: CreditFamily,
  tier: TwitchSubTier,
): ConversionUnit {
  if (family === "brl" || family === "bits") {
    return family;
  }

  return family === "sub" ? subUnitForTier(tier) : giftUnitForTier(tier);
}

function unitLabelKey(
  family: CreditFamily,
  tier: TwitchSubTier,
): string {
  if (family === "brl" || family === "bits") {
    return FAMILY_CONFIG[family].labelKey;
  }

  if (family === "sub") {
    switch (tier) {
      case "2000":
        return "SUBATHON_UNIT_SUB_T2";
      case "3000":
        return "SUBATHON_UNIT_SUB_T3";
      default:
        return "SUBATHON_UNIT_SUB_T1";
    }
  }

  switch (tier) {
    case "2000":
      return "SUBATHON_UNIT_SUB_GIFT_T2";
    case "3000":
      return "SUBATHON_UNIT_SUB_GIFT_T3";
    default:
      return "SUBATHON_UNIT_SUB_GIFT_T1";
  }
}

interface ManualCreditFormProps {
  rules: ConversionRule[];
  disabled: boolean;
  onAdd: (unit: ConversionUnit, amount: number) => void;
}

export function ManualCreditForm({
  rules,
  disabled,
  onAdd,
}: ManualCreditFormProps) {
  const { t } = useTranslation();
  const [family, setFamily] = useState<CreditFamily>("sub");
  const [tier, setTier] = useState<TwitchSubTier>("1000");
  const [manualAmount, setManualAmount] = useState("1");

  const needsTier = family === "sub" || family === "sub_gift";
  const manualUnit = resolveUnit(family, tier);
  const activeRule = rules.find((rule) => rule.unit === manualUnit);
  const integerOnly = FAMILY_CONFIG[family].integerOnly;

  const previewMs = useMemo(() => {
    const amount = Number(manualAmount);
    if (!activeRule || !Number.isFinite(amount) || amount <= 0) {
      return null;
    }

    return Math.round(activeRule.msPerUnit * amount);
  }, [activeRule, manualAmount]);

  const amountValid = useMemo(() => {
    const amount = Number(manualAmount);
    if (!Number.isFinite(amount) || amount <= 0) {
      return false;
    }

    if (integerOnly && !Number.isInteger(amount)) {
      return false;
    }

    return true;
  }, [integerOnly, manualAmount]);

  const handleFamilyChange = (next: CreditFamily) => {
    setFamily(next);
    setManualAmount(next === "sub" || next === "sub_gift" ? "1" : "");
  };

  const handleAdd = () => {
    const amount = Number(manualAmount);
    if (!amountValid) {
      return;
    }

    onAdd(manualUnit, amount);
    setManualAmount(family === "sub" || family === "sub_gift" ? "1" : "");
  };

  return (
    <div className="flex flex-col gap-4 border-t pt-4">
      <p className="font-medium">{t("SUBATHON_MANUAL_TITLE")}</p>

      <RadioGroup
        value={family}
        onValueChange={(value: string) =>
          handleFamilyChange(value as CreditFamily)
        }
        aria-label={t("SUBATHON_MANUAL_UNIT")}
        className="grid grid-cols-2 gap-2 lg:grid-cols-4"
      >
        {FAMILIES.map((item) => {
          const config = FAMILY_CONFIG[item];
          const Icon = config.icon;
          const selected = family === item;

          return (
            <TooltipProvider key={item}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <label
                    htmlFor={`manual-family-${item}`}
                    className={`flex cursor-pointer items-center gap-2 rounded-md border px-3 py-2 text-sm transition-colors ${
                      selected
                        ? "border-primary bg-primary/10"
                        : "border-border hover:bg-muted/50"
                    }`}
                  >
                    <RadioGroupItem
                      value={item}
                      id={`manual-family-${item}`}
                      className="sr-only"
                    />
                    <Icon className="size-4 shrink-0" aria-hidden="true" />
                    <span>{t(config.labelKey)}</span>
                  </label>
                </TooltipTrigger>
                <TooltipContent>{t(config.tooltipKey)}</TooltipContent>
              </Tooltip>
            </TooltipProvider>
          );
        })}
      </RadioGroup>

      {needsTier ? (
        <div className="grid gap-2">
          <Label>{t("SUBATHON_MANUAL_TIER")}</Label>
          <RadioGroup
            value={tier}
            onValueChange={(value: string) =>
              setTier(value as TwitchSubTier)
            }
            aria-label={t("SUBATHON_MANUAL_TIER")}
            className="grid grid-cols-3 gap-2"
          >
            {TWITCH_SUB_TIERS.map((item) => {
              const selected = tier === item;
              return (
                <label
                  key={item}
                  htmlFor={`manual-tier-${item}`}
                  className={`flex cursor-pointer items-center justify-center rounded-md border px-3 py-2 text-sm transition-colors ${
                    selected
                      ? "border-primary bg-primary/10"
                      : "border-border hover:bg-muted/50"
                  }`}
                >
                  <RadioGroupItem
                    value={item}
                    id={`manual-tier-${item}`}
                    className="sr-only"
                  />
                  <span>{t(TIER_LABEL_KEYS[item])}</span>
                </label>
              );
            })}
          </RadioGroup>
        </div>
      ) : null}

      <div className="grid gap-2">
        <Label htmlFor="manual-amount">{t("SUBATHON_MANUAL_AMOUNT")}</Label>
        <Input
          id="manual-amount"
          type="number"
          min={0}
          step={integerOnly ? 1 : 0.01}
          value={manualAmount}
          disabled={disabled}
          onChange={(event) => setManualAmount(event.target.value)}
        />
      </div>

      {previewMs !== null ? (
        <p className="text-sm text-muted-foreground">
          {t("SUBATHON_MANUAL_PREVIEW_DETAILED", {
            amount: manualAmount,
            unitLabel: t(unitLabelKey(family, tier)),
            duration: formatHumanDuration(previewMs),
          })}
        </p>
      ) : null}

      <Button
        onClick={handleAdd}
        disabled={disabled || !amountValid || !activeRule}
      >
        {t("SUBATHON_MANUAL_ADD")}
      </Button>
    </div>
  );
}
