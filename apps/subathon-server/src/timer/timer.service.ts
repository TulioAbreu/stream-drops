import { Injectable } from "@nestjs/common";
import {
  computeRemainingMs,
  type ConversionRule,
  type OverlayStyle,
  type SubathonSession,
  type TimerSnapshot,
  type TimerStatus,
} from "@stream-drops/subathon-protocol";
import { DatabaseService } from "../persistence/database.service";

interface SessionRow {
  id: string;
  name: string;
  conversion_rules_json: string;
  style_json: string;
  status: TimerStatus;
  remaining_ms: number;
  status_changed_at: string;
  created_at: string;
  updated_at: string;
  last_run_at: string | null;
  initial_ms: number;
}

const DEFAULT_STYLE: OverlayStyle = {
  fontFamily: "monospace",
  textColor: "#ffffff",
  backgroundColor: "transparent",
};

@Injectable()
export class TimerService {
  constructor(private readonly database: DatabaseService) {}

  getActiveSessionId(): string | null {
    const row = this.database.connection
      .prepare("SELECT session_id FROM active_pointer WHERE id = 1")
      .get() as { session_id: string | null };
    return row.session_id;
  }

  setActiveSessionId(sessionId: string | null) {
    this.database.connection
      .prepare("UPDATE active_pointer SET session_id = ? WHERE id = 1")
      .run(sessionId);
  }

  listSessions(): SubathonSession[] {
    const rows = this.database.connection
      .prepare("SELECT * FROM sessions ORDER BY created_at DESC")
      .all() as unknown as SessionRow[];

    return rows.map((row) => this.rowToSession(row));
  }

  getSession(sessionId: string): SubathonSession | null {
    const row = this.database.connection
      .prepare("SELECT * FROM sessions WHERE id = ?")
      .get(sessionId) as SessionRow | undefined;

    return row ? this.rowToSession(row) : null;
  }

  createSession(
    id: string,
    name: string,
    initialMs: number,
    rules: ConversionRule[],
  ): SubathonSession {
    const now = new Date().toISOString();
    const session: SessionRow = {
      id,
      name,
      conversion_rules_json: JSON.stringify(rules),
      style_json: JSON.stringify(DEFAULT_STYLE),
      status: initialMs > 0 ? "paused" : "ended",
      remaining_ms: initialMs,
      status_changed_at: now,
      created_at: now,
      updated_at: now,
      last_run_at: null,
      initial_ms: initialMs,
    };

    this.database.connection
      .prepare(
        `INSERT INTO sessions (
          id, name, conversion_rules_json, style_json, status,
          remaining_ms, status_changed_at, created_at, updated_at,
          last_run_at, initial_ms
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        session.id,
        session.name,
        session.conversion_rules_json,
        session.style_json,
        session.status,
        session.remaining_ms,
        session.status_changed_at,
        session.created_at,
        session.updated_at,
        session.last_run_at,
        session.initial_ms,
      );

    return this.rowToSession(session);
  }

  renameSession(sessionId: string, name: string): SubathonSession {
    const trimmed = name.trim();
    if (!trimmed) {
      throw new Error("Session name is required");
    }

    const now = new Date().toISOString();
    this.database.connection
      .prepare("UPDATE sessions SET name = ?, updated_at = ? WHERE id = ?")
      .run(trimmed, now, sessionId);

    const session = this.getSession(sessionId);
    if (!session) {
      throw new Error("Session not found");
    }

    return session;
  }

  deleteSession(sessionId: string) {
    const activeId = this.getActiveSessionId();
    if (activeId === sessionId) {
      this.setActiveSessionId(null);
    }

    this.database.connection
      .prepare("DELETE FROM ledger_entries WHERE session_id = ?")
      .run(sessionId);
    this.database.connection
      .prepare("DELETE FROM sessions WHERE id = ?")
      .run(sessionId);
  }

  updateConversion(sessionId: string, rules: ConversionRule[]): SubathonSession {
    const now = new Date().toISOString();
    this.database.connection
      .prepare(
        "UPDATE sessions SET conversion_rules_json = ?, updated_at = ? WHERE id = ?",
      )
      .run(JSON.stringify(rules), now, sessionId);

    const session = this.getSession(sessionId);
    if (!session) {
      throw new Error("Session not found");
    }

    return session;
  }

  updateStyle(sessionId: string, style: OverlayStyle): SubathonSession {
    const now = new Date().toISOString();
    this.database.connection
      .prepare("UPDATE sessions SET style_json = ?, updated_at = ? WHERE id = ?")
      .run(JSON.stringify(style), now, sessionId);

    const session = this.getSession(sessionId);
    if (!session) {
      throw new Error("Session not found");
    }

    return session;
  }

  materializeRemaining(row: SessionRow, now = new Date()): number {
    return computeRemainingMs(
      row.status,
      row.remaining_ms,
      row.status_changed_at,
      now,
    );
  }

  persistSnapshot(
    sessionId: string,
    status: TimerStatus,
    remainingMs: number,
    statusChangedAt: string,
    options?: { touchLastRun?: boolean },
  ) {
    const now = new Date().toISOString();
    if (options?.touchLastRun) {
      this.database.connection
        .prepare(
          `UPDATE sessions SET status = ?, remaining_ms = ?, status_changed_at = ?,
           updated_at = ?, last_run_at = ? WHERE id = ?`,
        )
        .run(
          status,
          remainingMs,
          statusChangedAt,
          now,
          statusChangedAt,
          sessionId,
        );
      return;
    }

    this.database.connection
      .prepare(
        `UPDATE sessions SET status = ?, remaining_ms = ?, status_changed_at = ?, updated_at = ? WHERE id = ?`,
      )
      .run(status, remainingMs, statusChangedAt, now, sessionId);
  }

  play(sessionId: string): SubathonSession {
    const row = this.getRow(sessionId);
    const now = new Date();
    const remaining = this.materializeRemaining(row, now);

    if (remaining <= 0) {
      this.persistSnapshot(sessionId, "ended", 0, now.toISOString());
      return this.getSession(sessionId)!;
    }

    this.persistSnapshot(sessionId, "running", remaining, now.toISOString(), {
      touchLastRun: true,
    });

    return this.getSession(sessionId)!;
  }

  pause(sessionId: string): SubathonSession {
    const row = this.getRow(sessionId);
    const now = new Date();
    const remaining = this.materializeRemaining(row, now);

    this.persistSnapshot(
      sessionId,
      row.status === "ended" ? "ended" : "paused",
      remaining,
      now.toISOString(),
    );

    return this.getSession(sessionId)!;
  }

  reset(sessionId: string, initialMs: number): SubathonSession {
    const now = new Date().toISOString();
    this.database.connection
      .prepare(
        `UPDATE sessions SET status = ?, remaining_ms = ?, status_changed_at = ?,
         updated_at = ?, initial_ms = ? WHERE id = ?`,
      )
      .run(
        initialMs > 0 ? "paused" : "ended",
        initialMs,
        now,
        now,
        initialMs,
        sessionId,
      );

    return this.getSession(sessionId)!;
  }

  setRemaining(sessionId: string, remainingMs: number): SubathonSession {
    if (!Number.isFinite(remainingMs) || remainingMs < 0) {
      throw new Error("Invalid remaining time");
    }

    const clamped = Math.max(0, Math.round(remainingMs));
    const status = clamped > 0 ? "paused" : "ended";
    const now = new Date().toISOString();

    this.persistSnapshot(sessionId, status, clamped, now);

    return this.getSession(sessionId)!;
  }

  applyDelta(
    sessionId: string,
    deltaMs: number,
    resumeIfEnded = true,
  ): SubathonSession {
    const row = this.getRow(sessionId);
    const now = new Date();
    let remaining = this.materializeRemaining(row, now);
    remaining = Math.max(0, remaining + deltaMs);

    let status: TimerStatus = row.status;
    if (remaining <= 0) {
      status = "ended";
      remaining = 0;
    } else if (resumeIfEnded && row.status === "ended" && deltaMs > 0) {
      status = "running";
    } else if (row.status === "running") {
      status = "running";
    }

    this.persistSnapshot(sessionId, status, remaining, now.toISOString(), {
      touchLastRun: status === "running" && row.status !== "running",
    });
    return this.getSession(sessionId)!;
  }

  buildSnapshot(sessionId: string | null): TimerSnapshot {
    const serverDate = new Date();
    const serverNow = serverDate.toISOString();

    if (!sessionId) {
      return {
        sessionId: null,
        status: "idle",
        remainingMs: 0,
        statusChangedAt: serverNow,
        serverNow,
      };
    }

    const row = this.getRow(sessionId);
    const materialized = this.materializeRemaining(row, serverDate);

    let status = row.status;
    if (status === "running" && materialized <= 0) {
      status = "ended";
      this.persistSnapshot(sessionId, "ended", 0, serverNow);
    }

    return {
      sessionId,
      status,
      remainingMs: status === "ended" ? 0 : materialized,
      statusChangedAt: serverNow,
      serverNow,
    };
  }

  msForUnit(sessionId: string, unit: string, amount: number): number {
    const session = this.getSession(sessionId);
    if (!session) {
      return 0;
    }

    const rule = session.conversionRules.find((item) => item.unit === unit);
    if (!rule) {
      return 0;
    }

    return Math.round(rule.msPerUnit * amount);
  }

  private getRow(sessionId: string): SessionRow {
    const row = this.database.connection
      .prepare("SELECT * FROM sessions WHERE id = ?")
      .get(sessionId) as SessionRow | undefined;

    if (!row) {
      throw new Error("Session not found");
    }

    return row;
  }

  private rowToSession(row: SessionRow): SubathonSession {
    const now = new Date();
    const remainingMs = this.materializeRemaining(row, now);
    let status = row.status;
    if (status === "running" && remainingMs <= 0) {
      status = "ended";
    }

    return {
      id: row.id,
      name: row.name,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      lastRunAt: row.last_run_at ?? null,
      initialMs: row.initial_ms ?? row.remaining_ms,
      conversionRules: JSON.parse(row.conversion_rules_json) as ConversionRule[],
      style: JSON.parse(row.style_json) as OverlayStyle,
      snapshot: {
        status,
        remainingMs: status === "ended" ? 0 : remainingMs,
        statusChangedAt: row.status_changed_at,
      },
    };
  }
}
