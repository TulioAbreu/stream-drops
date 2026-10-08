import { create } from "zustand";
import {
  persist,
  type PersistStorage,
  type StorageValue,
} from "zustand/middleware";
import { STORAGE_KEY_STREAM_DROPS_SETTINGS } from ".";

export const SETTINGS_STORAGE_VERSION = 1;

export interface BadgeSettings {
  enabled: boolean;
}

interface SettingsStore {
  badges: BadgeSettings;
  setBadgesEnabled: (enabled: boolean) => void;
}

type PersistedSettings = {
  badges: BadgeSettings;
};

const DEFAULT_BADGES: BadgeSettings = { enabled: true };

type StoredDocument = {
  state?: unknown;
  version?: unknown;
};

function readBadgesEnabled(persisted: unknown): BadgeSettings {
  if (!persisted || typeof persisted !== "object") return DEFAULT_BADGES;
  const badges = (persisted as { badges?: unknown }).badges;
  if (!badges || typeof badges !== "object") return DEFAULT_BADGES;
  const enabled = (badges as { enabled?: unknown }).enabled;
  if (typeof enabled !== "boolean") return DEFAULT_BADGES;
  return { enabled };
}

function parseStoredDocument(raw: string | null): StoredDocument | null {
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

function badgesFromDocument(document: StoredDocument | null): BadgeSettings {
  if (!document || document.version !== SETTINGS_STORAGE_VERSION) {
    return DEFAULT_BADGES;
  }
  return readBadgesEnabled(document.state);
}

function readInitialBadges(): BadgeSettings {
  try {
    if (typeof localStorage === "undefined") return DEFAULT_BADGES;
    const raw = localStorage.getItem(STORAGE_KEY_STREAM_DROPS_SETTINGS);
    return badgesFromDocument(parseStoredDocument(raw));
  } catch {
    return DEFAULT_BADGES;
  }
}

const storage: PersistStorage<PersistedSettings> = {
  getItem: (name) => {
    const stored = parseStoredDocument(localStorage.getItem(name));
    if (!stored) return null;
    // Versão que não é 1 fica no disco. Conta como ligado e não regrava.
    if (stored.version !== SETTINGS_STORAGE_VERSION) return null;
    return stored as StorageValue<PersistedSettings>;
  },
  setItem: (name, value) => {
    localStorage.setItem(name, JSON.stringify(value));
  },
  removeItem: (name) => {
    localStorage.removeItem(name);
  },
};

export const useSettingsStore = create<SettingsStore>()(
  persist(
    (set) => ({
      badges: readInitialBadges(),
      setBadgesEnabled: (enabled) => {
        set({ badges: { enabled } });
      },
    }),
    {
      name: STORAGE_KEY_STREAM_DROPS_SETTINGS,
      version: SETTINGS_STORAGE_VERSION,
      storage,
      partialize: (state): PersistedSettings => ({
        badges: { enabled: state.badges.enabled },
      }),
      migrate: (_persistedState, version): PersistedSettings => {
        if (version !== SETTINGS_STORAGE_VERSION) {
          return { badges: { ...DEFAULT_BADGES } };
        }
        return { badges: readBadgesEnabled(_persistedState) };
      },
      merge: (persistedState, currentState) => ({
        ...currentState,
        badges: readBadgesEnabled(persistedState),
      }),
    },
  ),
);
