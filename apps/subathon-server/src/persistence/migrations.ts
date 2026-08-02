export const MIGRATION_SQL = `
CREATE TABLE IF NOT EXISTS meta (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS sessions (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  conversion_rules_json TEXT NOT NULL,
  style_json TEXT NOT NULL,
  status TEXT NOT NULL,
  remaining_ms INTEGER NOT NULL,
  status_changed_at TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  last_run_at TEXT,
  initial_ms INTEGER NOT NULL DEFAULT 0,
  donation_bot_json TEXT NOT NULL DEFAULT '{}'
);

CREATE TABLE IF NOT EXISTS ledger_entries (
  id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL,
  type TEXT NOT NULL,
  delta_ms INTEGER NOT NULL,
  source TEXT NOT NULL,
  actor TEXT NOT NULL,
  amount REAL,
  unit TEXT,
  conversion_snapshot_json TEXT,
  external_event_id TEXT,
  created_at TEXT NOT NULL,
  undo_of_entry_id TEXT,
  undone_by_entry_id TEXT,
  FOREIGN KEY (session_id) REFERENCES sessions(id)
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_ledger_external_event
  ON ledger_entries(external_event_id)
  WHERE external_event_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS active_pointer (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  session_id TEXT
);
`;

/** Incremental alters for DBs created before protocol v2/v3. */
export const SCHEMA_ALTERS = [
  "ALTER TABLE sessions ADD COLUMN last_run_at TEXT",
  "ALTER TABLE sessions ADD COLUMN initial_ms INTEGER NOT NULL DEFAULT 0",
  "ALTER TABLE sessions ADD COLUMN donation_bot_json TEXT NOT NULL DEFAULT '{}'",
] as const;
