import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from "@nestjs/common";
import { DatabaseSync } from "node:sqlite";
import { MIGRATION_SQL, SCHEMA_ALTERS } from "./migrations";
import { resolveDatabasePath } from "../utils/db-path.util";

@Injectable()
export class DatabaseService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(DatabaseService.name);
  private db!: DatabaseSync;
  readonly dbPath = resolveDatabasePath();

  onModuleInit() {
    this.db = new DatabaseSync(this.dbPath);
    this.db.exec("PRAGMA journal_mode = WAL");
    this.db.exec(MIGRATION_SQL);

    for (const alter of SCHEMA_ALTERS) {
      try {
        this.db.exec(alter);
      } catch {
        // Column already exists on newer DBs.
      }
    }

    this.db.exec(
      `UPDATE sessions SET initial_ms = remaining_ms
       WHERE initial_ms = 0 AND remaining_ms > 0`,
    );

    const active = this.db
      .prepare("SELECT session_id FROM active_pointer WHERE id = 1")
      .get() as { session_id: string | null } | undefined;

    if (!active) {
      this.db
        .prepare("INSERT INTO active_pointer (id, session_id) VALUES (1, NULL)")
        .run();
    }

    this.logger.log(`SQLite ready at ${this.dbPath}`);
  }

  onModuleDestroy() {
    this.db?.close();
  }

  get connection(): DatabaseSync {
    return this.db;
  }

  getMeta(key: string): string | null {
    const row = this.db
      .prepare("SELECT value FROM meta WHERE key = ?")
      .get(key) as { value: string } | undefined;
    return row?.value ?? null;
  }

  setMeta(key: string, value: string) {
    this.db
      .prepare(
        "INSERT INTO meta (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value",
      )
      .run(key, value);
  }
}
