import { Injectable } from "@nestjs/common";
import {
  type ConversionRule,
  type LedgerEntry,
  type LedgerEntryType,
  type LedgerSource,
} from "@stream-drops/subathon-protocol";
import { v7 as uuidv7 } from "uuid";
import { DatabaseService } from "../persistence/database.service";
import { TimerService } from "../timer/timer.service";

interface LedgerRow {
  id: string;
  session_id: string;
  type: LedgerEntryType;
  delta_ms: number;
  source: LedgerSource;
  actor: string;
  amount: number | null;
  unit: string | null;
  conversion_snapshot_json: string | null;
  external_event_id: string | null;
  created_at: string;
  undo_of_entry_id: string | null;
  undone_by_entry_id: string | null;
}

@Injectable()
export class LedgerService {
  constructor(
    private readonly database: DatabaseService,
    private readonly timer: TimerService,
  ) {}

  listEntries(sessionId: string, limit = 100): LedgerEntry[] {
    const rows = this.database.connection
      .prepare(
        `SELECT * FROM ledger_entries WHERE session_id = ?
         ORDER BY created_at DESC LIMIT ?`,
      )
      .all(sessionId, limit) as unknown as LedgerRow[];

    return rows.map((row) => this.rowToEntry(row));
  }

  hasExternalEvent(externalEventId: string): boolean {
    const row = this.database.connection
      .prepare(
        "SELECT id FROM ledger_entries WHERE external_event_id = ? LIMIT 1",
      )
      .get(externalEventId) as { id: string } | undefined;

    return Boolean(row);
  }

  addCredit(params: {
    sessionId: string;
    deltaMs: number;
    source: LedgerSource;
    actor: string;
    amount?: number | null;
    unit?: string | null;
    conversionSnapshot?: ConversionRule[] | null;
    externalEventId?: string | null;
  }): LedgerEntry {
    if (
      params.externalEventId &&
      this.hasExternalEvent(params.externalEventId)
    ) {
      throw new Error("DUPLICATE_EVENT");
    }

    const entry = this.insertEntry({
      sessionId: params.sessionId,
      type: "credit",
      deltaMs: params.deltaMs,
      source: params.source,
      actor: params.actor,
      amount: params.amount ?? null,
      unit: params.unit ?? null,
      conversionSnapshot: params.conversionSnapshot ?? null,
      externalEventId: params.externalEventId ?? null,
    });

    this.timer.applyDelta(params.sessionId, params.deltaMs, true);
    return entry;
  }

  addManualCredit(
    sessionId: string,
    unit: string,
    amount: number,
    actor: string,
  ): LedgerEntry {
    const session = this.timer.getSession(sessionId);
    if (!session) {
      throw new Error("Session not found");
    }

    const deltaMs = this.timer.msForUnit(sessionId, unit, amount);
    return this.addCredit({
      sessionId,
      deltaMs,
      source: "manual",
      actor,
      amount,
      unit,
      conversionSnapshot: session.conversionRules,
    });
  }

  addDebit(
    sessionId: string,
    deltaMs: number,
    actor: string,
    source: LedgerSource = "manual",
  ): LedgerEntry {
    const entry = this.insertEntry({
      sessionId,
      type: "debit",
      deltaMs: -Math.abs(deltaMs),
      source,
      actor,
      amount: null,
      unit: null,
      conversionSnapshot: null,
      externalEventId: null,
    });

    this.timer.applyDelta(sessionId, entry.deltaMs, false);
    return entry;
  }

  undoEntry(entryId: string, actor: string): LedgerEntry {
    const original = this.database.connection
      .prepare("SELECT * FROM ledger_entries WHERE id = ?")
      .get(entryId) as LedgerRow | undefined;

    if (!original) {
      throw new Error("Entry not found");
    }

    if (original.undone_by_entry_id) {
      throw new Error("Entry already undone");
    }

    const undoEntry = this.insertEntry({
      sessionId: original.session_id,
      type: "undo",
      deltaMs: -original.delta_ms,
      source: "system",
      actor,
      amount: original.amount,
      unit: original.unit,
      conversionSnapshot: original.conversion_snapshot_json
        ? (JSON.parse(original.conversion_snapshot_json) as ConversionRule[])
        : null,
      externalEventId: null,
      undoOfEntryId: entryId,
    });

    this.database.connection
      .prepare("UPDATE ledger_entries SET undone_by_entry_id = ? WHERE id = ?")
      .run(undoEntry.id, entryId);

    this.timer.applyDelta(original.session_id, undoEntry.deltaMs, true);
    return undoEntry;
  }

  recordSystemEntry(
    sessionId: string,
    type: LedgerEntryType,
    deltaMs: number,
    actor: string,
  ): LedgerEntry {
    return this.insertEntry({
      sessionId,
      type,
      deltaMs,
      source: "system",
      actor,
      amount: null,
      unit: null,
      conversionSnapshot: null,
      externalEventId: null,
    });
  }

  private insertEntry(params: {
    sessionId: string;
    type: LedgerEntryType;
    deltaMs: number;
    source: LedgerSource;
    actor: string;
    amount: number | null;
    unit: string | null;
    conversionSnapshot: ConversionRule[] | null;
    externalEventId: string | null;
    undoOfEntryId?: string;
  }): LedgerEntry {
    const id = uuidv7();
    const createdAt = new Date().toISOString();

    this.database.connection
      .prepare(
        `INSERT INTO ledger_entries (
          id, session_id, type, delta_ms, source, actor, amount, unit,
          conversion_snapshot_json, external_event_id, created_at,
          undo_of_entry_id, undone_by_entry_id
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL)`,
      )
      .run(
        id,
        params.sessionId,
        params.type,
        params.deltaMs,
        params.source,
        params.actor,
        params.amount,
        params.unit,
        params.conversionSnapshot
          ? JSON.stringify(params.conversionSnapshot)
          : null,
        params.externalEventId,
        createdAt,
        params.undoOfEntryId ?? null,
      );

    return {
      id,
      sessionId: params.sessionId,
      type: params.type,
      deltaMs: params.deltaMs,
      source: params.source,
      actor: params.actor,
      amount: params.amount,
      unit: params.unit as LedgerEntry["unit"],
      conversionSnapshot: params.conversionSnapshot,
      externalEventId: params.externalEventId,
      createdAt,
      undoOfEntryId: params.undoOfEntryId ?? null,
      undoneByEntryId: null,
    };
  }

  private rowToEntry(row: LedgerRow): LedgerEntry {
    return {
      id: row.id,
      sessionId: row.session_id,
      type: row.type,
      deltaMs: row.delta_ms,
      source: row.source,
      actor: row.actor,
      amount: row.amount,
      unit: row.unit as LedgerEntry["unit"],
      conversionSnapshot: row.conversion_snapshot_json
        ? (JSON.parse(row.conversion_snapshot_json) as ConversionRule[])
        : null,
      externalEventId: row.external_event_id,
      createdAt: row.created_at,
      undoOfEntryId: row.undo_of_entry_id,
      undoneByEntryId: row.undone_by_entry_id,
    };
  }
}
