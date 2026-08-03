import type {
  ConversionRule,
  ConversionUnit,
  TwitchSubTier,
} from "./types";

export const TWITCH_SUB_TIERS: readonly TwitchSubTier[] = [
  "1000",
  "2000",
  "3000",
];

export const CONVERSION_UNITS: readonly ConversionUnit[] = [
  "brl",
  "bits",
  "sub_1000",
  "sub_2000",
  "sub_3000",
  "sub_gift_1000",
  "sub_gift_2000",
  "sub_gift_3000",
];

const DEFAULT_MS_PER_UNIT: Record<ConversionUnit, number> = {
  brl: 60_000,
  bits: 1_000,
  sub_1000: 300_000,
  sub_2000: 600_000,
  sub_3000: 900_000,
  sub_gift_1000: 300_000,
  sub_gift_2000: 600_000,
  sub_gift_3000: 900_000,
};

const DEFAULT_LABELS: Record<ConversionUnit, string> = {
  brl: "R$",
  bits: "bits",
  sub_1000: "sub T1",
  sub_2000: "sub T2",
  sub_3000: "sub T3",
  sub_gift_1000: "sub gift T1",
  sub_gift_2000: "sub gift T2",
  sub_gift_3000: "sub gift T3",
};

export const DEFAULT_CONVERSION_RULES: ConversionRule[] =
  CONVERSION_UNITS.map((unit) => ({
    unit,
    msPerUnit: DEFAULT_MS_PER_UNIT[unit],
    label: DEFAULT_LABELS[unit],
  }));

export function isConversionUnit(value: string): value is ConversionUnit {
  return (CONVERSION_UNITS as readonly string[]).includes(value);
}

export function parseTwitchSubTier(
  value: string | null | undefined,
): TwitchSubTier {
  if (value === "2000" || value === "3000") {
    return value;
  }

  return "1000";
}

export function subUnitForTier(tier: TwitchSubTier): ConversionUnit {
  switch (tier) {
    case "2000":
      return "sub_2000";
    case "3000":
      return "sub_3000";
    default:
      return "sub_1000";
  }
}

export function giftUnitForTier(tier: TwitchSubTier): ConversionUnit {
  switch (tier) {
    case "2000":
      return "sub_gift_2000";
    case "3000":
      return "sub_gift_3000";
    default:
      return "sub_gift_1000";
  }
}

export function tierFromConversionUnit(
  unit: ConversionUnit,
): TwitchSubTier | null {
  if (unit.startsWith("sub_gift_")) {
    return parseTwitchSubTier(unit.slice("sub_gift_".length));
  }

  if (unit.startsWith("sub_")) {
    return parseTwitchSubTier(unit.slice("sub_".length));
  }

  return null;
}

interface RawConversionRule {
  unit: string;
  msPerUnit: number;
  label?: string;
}

/**
 * Expands legacy flat `sub` / `sub_gift` rules into per-tier units and
 * ensures every known ConversionUnit is present.
 */
export function normalizeConversionRules(
  rules: RawConversionRule[] | null | undefined,
): ConversionRule[] {
  const byUnit = new Map<ConversionUnit, ConversionRule>();

  for (const rule of rules ?? []) {
    if (rule.unit === "sub") {
      for (const tier of TWITCH_SUB_TIERS) {
        const unit = subUnitForTier(tier);
        if (!byUnit.has(unit)) {
          byUnit.set(unit, {
            unit,
            msPerUnit: rule.msPerUnit,
            label: DEFAULT_LABELS[unit],
          });
        }
      }
      continue;
    }

    if (rule.unit === "sub_gift") {
      for (const tier of TWITCH_SUB_TIERS) {
        const unit = giftUnitForTier(tier);
        if (!byUnit.has(unit)) {
          byUnit.set(unit, {
            unit,
            msPerUnit: rule.msPerUnit,
            label: DEFAULT_LABELS[unit],
          });
        }
      }
      continue;
    }

    if (!isConversionUnit(rule.unit)) {
      continue;
    }

    byUnit.set(rule.unit, {
      unit: rule.unit,
      msPerUnit: rule.msPerUnit,
      label: rule.label ?? DEFAULT_LABELS[rule.unit],
    });
  }

  return CONVERSION_UNITS.map((unit) => {
    const existing = byUnit.get(unit);
    if (existing) {
      return existing;
    }

    return {
      unit,
      msPerUnit: DEFAULT_MS_PER_UNIT[unit],
      label: DEFAULT_LABELS[unit],
    };
  });
}
