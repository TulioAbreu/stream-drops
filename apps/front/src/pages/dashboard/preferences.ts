import { STORAGE_KEY_STREAM_DROPS_SETTINGS } from "@/storage";

/**
 * Preferências da Dashboard dentro de `stream-drops-settings`.
 * Ler não grava. Valor ausente ou desconhecido vira o padrão.
 * A escrita só acontece numa ação explícita (trocar filtro ou dispensar aviso)
 * e preserva o restante da chave. Versão diferente de 1 não é regravada.
 */

export const DASHBOARD_PERIODS = ["month", "all"] as const;
export const DASHBOARD_TYPES = [
  "all",
  "chat",
  "channel-points",
  "subscribers",
] as const;

export type DashboardPeriod = (typeof DASHBOARD_PERIODS)[number];
export type DashboardType = (typeof DASHBOARD_TYPES)[number];

export type DashboardPreferences = {
  period: DashboardPeriod;
  type: DashboardType;
  dismissLocalHistory: boolean;
  dismissChatLegacy: boolean;
};

export type DashboardPreferencePatch = Partial<DashboardPreferences>;

const DEFAULTS: DashboardPreferences = {
  period: "month",
  type: "all",
  dismissLocalHistory: false,
  dismissChatLegacy: false,
};

const PERIODS = new Set<string>(DASHBOARD_PERIODS);
const TYPES = new Set<string>(DASHBOARD_TYPES);

type StoredDocument = {
  state?: unknown;
  version?: unknown;
};

function parseDocument(raw: string | null): StoredDocument | null {
  if (raw == null || raw === "") return null;
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      return null;
    }
    return parsed as StoredDocument;
  } catch {
    return null;
  }
}

function asState(document: StoredDocument | null): Record<string, unknown> | null {
  if (!document || document.version !== 1) return null;
  const state = document.state;
  if (!state || typeof state !== "object" || Array.isArray(state)) return null;
  return state as Record<string, unknown>;
}

function readChoice<T extends string>(
  value: unknown,
  allowed: Set<string>,
  fallback: T,
): T {
  return typeof value === "string" && allowed.has(value) ? (value as T) : fallback;
}

function readFlag(value: unknown): boolean {
  return value === true;
}

export function readDashboardPreferences(
  raw = readRaw(),
): DashboardPreferences {
  const state = asState(parseDocument(raw));
  const dashboard = state?.dashboard;
  if (!dashboard || typeof dashboard !== "object" || Array.isArray(dashboard)) {
    return { ...DEFAULTS };
  }
  const record = dashboard as Record<string, unknown>;
  return {
    period: readChoice(record.period, PERIODS, DEFAULTS.period),
    type: readChoice(record.type, TYPES, DEFAULTS.type),
    dismissLocalHistory: readFlag(record.dismissLocalHistory),
    dismissChatLegacy: readFlag(record.dismissChatLegacy),
  };
}

function readRaw(): string | null {
  try {
    if (typeof localStorage === "undefined") return null;
    return localStorage.getItem(STORAGE_KEY_STREAM_DROPS_SETTINGS);
  } catch {
    return null;
  }
}

function serialize(value: DashboardPreferences): Record<string, unknown> {
  return {
    period: value.period,
    type: value.type,
    dismissLocalHistory: value.dismissLocalHistory,
    dismissChatLegacy: value.dismissChatLegacy,
  };
}

/**
 * Grava só o pedaço `dashboard`. Devolve false quando não houve escrita
 * (já era o valor, versão desconhecida, ou storage indisponível).
 */
export function writeDashboardPreference(
  patch: DashboardPreferencePatch,
): boolean {
  let raw: string | null;
  try {
    raw = localStorage.getItem(STORAGE_KEY_STREAM_DROPS_SETTINGS);
  } catch {
    return false;
  }
  const document = parseDocument(raw);
  if (raw != null && raw !== "" && (!document || document.version !== 1)) {
    return false;
  }

  const state =
    document &&
    document.state &&
    typeof document.state === "object" &&
    !Array.isArray(document.state)
      ? { ...(document.state as Record<string, unknown>) }
      : {};

  const current = readDashboardPreferences(raw);
  const next: DashboardPreferences = {
    period: patch.period ?? current.period,
    type: patch.type ?? current.type,
    dismissLocalHistory: patch.dismissLocalHistory ?? current.dismissLocalHistory,
    dismissChatLegacy: patch.dismissChatLegacy ?? current.dismissChatLegacy,
  };
  state.dashboard = serialize(next);
  const payload = JSON.stringify({ state, version: 1 });
  if (payload === raw) return false;
  try {
    localStorage.setItem(STORAGE_KEY_STREAM_DROPS_SETTINGS, payload);
  } catch {
    return false;
  }
  return true;
}
