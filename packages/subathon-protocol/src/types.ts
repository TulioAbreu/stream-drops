export type TimerStatus = "idle" | "running" | "paused" | "ended";

export type LedgerEntryType =
  | "init"
  | "credit"
  | "debit"
  | "pause"
  | "resume"
  | "set"
  | "undo";

export type LedgerSource = "manual" | "eventsub" | "chat" | "system";

export type TwitchSubTier = "1000" | "2000" | "3000";

export type ConversionUnit =
  | "brl"
  | "bits"
  | "sub_1000"
  | "sub_2000"
  | "sub_3000"
  | "sub_gift_1000"
  | "sub_gift_2000"
  | "sub_gift_3000";

/** Units persisted before protocol v3 (flat sub / gift). */
export type LegacyConversionUnit = "sub" | "sub_gift";

export type LedgerConversionUnit = ConversionUnit | LegacyConversionUnit;

export interface ConversionRule {
  unit: ConversionUnit;
  msPerUnit: number;
  label?: string;
}

export interface OverlayStyle {
  fontFamily?: string;
  fontUrl?: string;
  textColor?: string;
  backgroundColor?: string;
  gradient?: string;
  backdropBlur?: number;
  customCss?: string;
}

export interface DonationBotConfig {
  enabled: boolean;
  botUsername: string;
  templates: string[];
}

export interface TimerSnapshot {
  sessionId: string | null;
  status: TimerStatus;
  remainingMs: number;
  statusChangedAt: string;
  serverNow: string;
}

export interface SubathonSession {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
  lastRunAt: string | null;
  initialMs: number;
  conversionRules: ConversionRule[];
  style: OverlayStyle;
  donationBot: DonationBotConfig;
  snapshot: Omit<TimerSnapshot, "sessionId" | "serverNow">;
}

export interface LedgerEntry {
  id: string;
  sessionId: string;
  type: LedgerEntryType;
  deltaMs: number;
  source: LedgerSource;
  actor: string;
  amount: number | null;
  unit: LedgerConversionUnit | null;
  conversionSnapshot: ConversionRule[] | null;
  externalEventId: string | null;
  createdAt: string;
  undoOfEntryId: string | null;
  undoneByEntryId: string | null;
}

export type ClientMessage =
  | { type: "hello"; client: "front" | "overlay" | "unknown" }
  | {
      type: "configureTwitch";
      accessToken: string;
      broadcasterUserId: string;
      channelLogin: string;
      clientId: string;
      enabled: boolean;
      chatEnabled?: boolean;
    }
  | {
      type: "createSession";
      name: string;
      initialMs: number;
      rules: ConversionRule[];
      activate?: boolean;
    }
  | { type: "listSessions" }
  | { type: "setActiveSession"; sessionId: string | null }
  | { type: "renameSession"; sessionId: string; name: string }
  | { type: "deleteSession"; sessionId: string }
  | { type: "updateConversion"; sessionId: string; rules: ConversionRule[] }
  | { type: "updateStyle"; sessionId: string; style: OverlayStyle }
  | {
      type: "updateDonationBot";
      sessionId: string;
      config: DonationBotConfig;
    }
  | { type: "timer.play" }
  | { type: "timer.pause" }
  | { type: "timer.reset"; initialMs: number }
  | { type: "timer.addMinutes"; minutes: number; actor: string }
  | { type: "timer.setRemaining"; remainingMs: number; actor: string }
  | {
      type: "ledger.add";
      unit: ConversionUnit;
      amount: number;
      actor: string;
      note?: string;
    }
  | { type: "ledger.undo"; entryId: string; actor: string }
  | { type: "ledger.list"; sessionId: string; limit?: number };

export type ServerMessage =
  | {
      type: "hello.ok";
      protocolVersion: number;
      port: number;
      activeSessionId: string | null;
      dbPath: string;
    }
  | { type: "timer.snapshot"; snapshot: TimerSnapshot }
  | { type: "session.updated"; session: SubathonSession }
  | { type: "session.created"; session: SubathonSession }
  | { type: "session.deleted"; sessionId: string }
  | { type: "sessions.list"; sessions: SubathonSession[] }
  | { type: "ledger.entry"; entry: LedgerEntry }
  | { type: "ledger.list"; entries: LedgerEntry[] }
  | { type: "connection.status"; connected: boolean; eventsub: boolean }
  | { type: "error"; code: string; message: string };
