import type {
  ConversionRule,
  ConversionUnit,
  LedgerEntry,
  OverlayStyle,
} from "@stream-drops/subathon-protocol";

export const DEFAULT_CONVERSION_RULES: ConversionRule[] = [
  { unit: "brl", msPerUnit: 60_000, label: "R$" },
  { unit: "bits", msPerUnit: 1_000, label: "bits" },
  { unit: "sub", msPerUnit: 300_000, label: "sub" },
  { unit: "sub_gift", msPerUnit: 300_000, label: "sub gift" },
];

export const EVENTSUB_ENABLED_STORAGE_KEY = "stream-drops-subathon-eventsub";

export interface HmsSegments {
  hours: number;
  minutes: number;
  seconds: number;
}

export function msToHms(ms: number): HmsSegments {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  return { hours, minutes, seconds };
}

export function hmsToMs(segments: HmsSegments): number | null {
  const { hours, minutes, seconds } = segments;

  if (
    !Number.isFinite(hours) ||
    !Number.isFinite(minutes) ||
    !Number.isFinite(seconds) ||
    hours < 0 ||
    minutes < 0 ||
    seconds < 0 ||
    minutes > 59 ||
    seconds > 59
  ) {
    return null;
  }

  return (hours * 3600 + minutes * 60 + seconds) * 1000;
}

export function formatTimerHms(ms: number): string {
  const { hours, minutes, seconds } = msToHms(ms);

  return [hours, minutes, seconds]
    .map((value) => String(value).padStart(2, "0"))
    .join(":");
}

export function formatHumanDuration(ms: number): string {
  const totalSeconds = Math.max(0, Math.round(Math.abs(ms) / 1000));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  const parts: string[] = [];

  if (hours > 0) {
    parts.push(`${hours} h`);
  }

  if (minutes > 0) {
    parts.push(`${minutes} min`);
  }

  if (seconds > 0 || parts.length === 0) {
    parts.push(`${seconds} s`);
  }

  return parts.join(" ");
}

export function formatSignedDuration(ms: number): string {
  if (ms === 0) {
    return "0 s";
  }

  const sign = ms > 0 ? "+" : "−";
  return `${sign}${formatHumanDuration(ms)}`;
}

export function msFromMinutes(minutes: number) {
  return minutes * 60_000;
}

export function minutesFromMs(ms: number) {
  return Math.round(ms / 60_000);
}

export function formatSessionDate(iso: string | null | undefined) {
  if (!iso) {
    return "—";
  }

  return new Date(iso).toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

const DEFAULT_OVERLAY_STYLE: Required<
  Pick<
    OverlayStyle,
    | "fontFamily"
    | "textColor"
    | "backgroundColor"
    | "gradient"
    | "backdropBlur"
    | "customCss"
  >
> = {
  fontFamily: "monospace",
  textColor: "#ffffff",
  backgroundColor: "transparent",
  gradient: "",
  backdropBlur: 0,
  customCss: "",
};

export function normalizeOverlayStyle(
  style: OverlayStyle | undefined,
): Required<
  Pick<
    OverlayStyle,
    | "fontFamily"
    | "textColor"
    | "backgroundColor"
    | "gradient"
    | "backdropBlur"
    | "customCss"
  >
> {
  return {
    fontFamily: style?.fontFamily ?? DEFAULT_OVERLAY_STYLE.fontFamily,
    textColor: style?.textColor ?? DEFAULT_OVERLAY_STYLE.textColor,
    backgroundColor:
      style?.backgroundColor ?? DEFAULT_OVERLAY_STYLE.backgroundColor,
    gradient: style?.gradient ?? DEFAULT_OVERLAY_STYLE.gradient,
    backdropBlur: style?.backdropBlur ?? DEFAULT_OVERLAY_STYLE.backdropBlur,
    customCss: style?.customCss ?? DEFAULT_OVERLAY_STYLE.customCss,
  };
}

export function areConversionRulesEqual(
  left: ConversionRule[],
  right: ConversionRule[],
): boolean {
  if (left.length !== right.length) {
    return false;
  }

  return left.every((rule, index) => {
    const other = right[index];
    return (
      rule.unit === other?.unit &&
      rule.msPerUnit === other.msPerUnit &&
      (rule.label ?? "") === (other.label ?? "")
    );
  });
}

export function areOverlayStylesEqual(
  left: OverlayStyle,
  right: OverlayStyle,
): boolean {
  const normalizedLeft = normalizeOverlayStyle(left);
  const normalizedRight = normalizeOverlayStyle(right);

  return (
    normalizedLeft.fontFamily === normalizedRight.fontFamily &&
    normalizedLeft.textColor === normalizedRight.textColor &&
    normalizedLeft.backgroundColor === normalizedRight.backgroundColor &&
    normalizedLeft.gradient === normalizedRight.gradient &&
    normalizedLeft.backdropBlur === normalizedRight.backdropBlur &&
    normalizedLeft.customCss === normalizedRight.customCss
  );
}

export function getConversionUnitLabel(unit: ConversionUnit): string {
  switch (unit) {
    case "brl":
      return "R$";
    case "bits":
      return "bits";
    case "sub":
      return "sub";
    case "sub_gift":
      return "sub gift";
    default:
      return unit;
  }
}

export function formatLedgerAmount(entry: LedgerEntry): string {
  if (entry.amount == null) {
    if (entry.type === "pause" || entry.type === "resume") {
      return "—";
    }

    if (entry.unit == null && entry.deltaMs !== 0) {
      return formatHumanDuration(entry.deltaMs);
    }

    return "—";
  }

  switch (entry.unit) {
    case "brl":
      return new Intl.NumberFormat("pt-BR", {
        style: "currency",
        currency: "BRL",
      }).format(entry.amount);
    case "bits":
      return `${entry.amount} bits`;
    case "sub":
      return entry.amount === 1 ? "1 sub" : `${entry.amount} subs`;
    case "sub_gift":
      return entry.amount === 1
        ? "1 sub presenteado"
        : `${entry.amount} subs presenteados`;
    default:
      return `${entry.amount} ${entry.unit ?? ""}`.trim();
  }
}

export type LedgerSourceLabelKey =
  | "SUBATHON_SOURCE_MANUAL"
  | "SUBATHON_SOURCE_EVENTSUB"
  | "SUBATHON_SOURCE_CHAT"
  | "SUBATHON_SOURCE_INIT"
  | "SUBATHON_SOURCE_TIMER"
  | "SUBATHON_SOURCE_UNDO";

export function getLedgerSourceLabelKey(
  entry: LedgerEntry,
): LedgerSourceLabelKey {
  if (entry.type === "undo") {
    return "SUBATHON_SOURCE_UNDO";
  }

  if (entry.type === "init") {
    return "SUBATHON_SOURCE_INIT";
  }

  if (
    entry.type === "pause" ||
    entry.type === "resume" ||
    entry.type === "set"
  ) {
    return "SUBATHON_SOURCE_TIMER";
  }

  switch (entry.source) {
    case "eventsub":
      return "SUBATHON_SOURCE_EVENTSUB";
    case "chat":
      return "SUBATHON_SOURCE_CHAT";
    case "manual":
      return "SUBATHON_SOURCE_MANUAL";
    default:
      return "SUBATHON_SOURCE_TIMER";
  }
}

export function canUndoLedgerEntry(entry: LedgerEntry): boolean {
  return (
    !entry.undoneByEntryId &&
    entry.type !== "undo" &&
    entry.type !== "init" &&
    entry.type !== "pause" &&
    entry.type !== "resume"
  );
}

export function applyOverlayStylePreview(
  root: HTMLElement,
  style: OverlayStyle | undefined,
) {
  root.style.setProperty(
    "--subathon-font",
    style?.fontFamily ?? "monospace",
  );
  root.style.setProperty(
    "--subathon-text",
    style?.textColor ?? "#ffffff",
  );
  root.style.setProperty(
    "--subathon-bg",
    style?.gradient || style?.backgroundColor || "transparent",
  );
  root.style.setProperty(
    "--subathon-blur",
    `${style?.backdropBlur ?? 0}px`,
  );
}
