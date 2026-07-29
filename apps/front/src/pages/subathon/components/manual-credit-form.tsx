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
} from "@stream-drops/subathon-protocol";
import {
  CircleDollarSign,
  Gem,
  Gift,
  Star,
} from "lucide-react";
import { useMemo, useState } from "react";
import { formatHumanDuration } from "../utils";

const UNIT_CONFIG: Record<
  ConversionUnit,
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
  const availableUnits = rules.map((rule) => rule.unit);
  const defaultUnit = availableUnits[0] ?? "sub";
  const [manualUnit, setManualUnit] = useState<ConversionUnit>(defaultUnit);
  const [manualAmount, setManualAmount] = useState(
    defaultUnit === "sub" ? "1" : "",
  );

  const activeRule = rules.find((rule) => rule.unit === manualUnit);

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

    if (UNIT_CONFIG[manualUnit].integerOnly && !Number.isInteger(amount)) {
      return false;
    }

    return true;
  }, [manualAmount, manualUnit]);

  const handleUnitChange = (unit: ConversionUnit) => {
    setManualUnit(unit);
    setManualAmount(unit === "sub" ? "1" : "");
  };

  const handleAdd = () => {
    const amount = Number(manualAmount);
    if (!amountValid) {
      return;
    }

    onAdd(manualUnit, amount);
    setManualAmount(manualUnit === "sub" ? "1" : "");
  };

  return (
    <div className="flex flex-col gap-4 border-t pt-4">
      <p className="font-medium">{t("SUBATHON_MANUAL_TITLE")}</p>

      <RadioGroup
        value={manualUnit}
        onValueChange={(value: string) =>
          handleUnitChange(value as ConversionUnit)
        }
        aria-label={t("SUBATHON_MANUAL_UNIT")}
        className="grid grid-cols-2 gap-2 lg:grid-cols-4"
      >
        {availableUnits.map((unit) => {
          const config = UNIT_CONFIG[unit];
          const Icon = config.icon;
          const selected = manualUnit === unit;

          return (
            <TooltipProvider key={unit}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <label
                    htmlFor={`manual-unit-${unit}`}
                    className={`flex cursor-pointer items-center gap-2 rounded-md border px-3 py-2 text-sm transition-colors ${
                      selected
                        ? "border-primary bg-primary/10"
                        : "border-border hover:bg-muted/50"
                    }`}
                  >
                    <RadioGroupItem
                      value={unit}
                      id={`manual-unit-${unit}`}
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

      <div className="grid gap-2">
        <Label htmlFor="manual-amount">{t("SUBATHON_MANUAL_AMOUNT")}</Label>
        <Input
          id="manual-amount"
          type="number"
          min={0}
          step={UNIT_CONFIG[manualUnit].integerOnly ? 1 : 0.01}
          value={manualAmount}
          disabled={disabled}
          onChange={(event) => setManualAmount(event.target.value)}
        />
      </div>

      {previewMs !== null ? (
        <p className="text-sm text-muted-foreground">
          {t("SUBATHON_MANUAL_PREVIEW_DETAILED", {
            amount: manualAmount,
            unitLabel: t(UNIT_CONFIG[manualUnit].labelKey),
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
