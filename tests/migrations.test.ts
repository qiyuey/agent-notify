import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { describe, expect, it } from "vitest";
import { GatewayDatabase } from "../src/storage/database.js";

describe("delivery-only migration", () => {
  it("creates only the notification queue on a fresh database", () => {
    const database = new GatewayDatabase(":memory:");
    const tables = tableNames(database);
    expect(tables).toEqual(["outbound_notifications", "schema_migrations"]);
    expect(database.connection.prepare("SELECT version FROM schema_migrations").get()).toEqual({
      version: 10,
    });
    database.close();
  });

  it("preserves notifications while dropping legacy conversation tables", () => {
    const directory = mkdtempSync(join(tmpdir(), "codex-im-migration-"));
    const path = join(directory, "gateway.sqlite");
    try {
      const legacy = new DatabaseSync(path);
      legacy.exec(`
        CREATE TABLE schema_migrations (
          version INTEGER PRIMARY KEY, name TEXT NOT NULL, applied_at INTEGER NOT NULL
        ) STRICT;
        INSERT INTO schema_migrations VALUES (9, 'legacy', 0);
        CREATE TABLE outbound_notifications (
          id TEXT PRIMARY KEY, idempotency_key TEXT NOT NULL UNIQUE, channel TEXT NOT NULL,
          cwd TEXT NOT NULL, title TEXT NOT NULL, message TEXT NOT NULL, state TEXT NOT NULL,
          attempt_count INTEGER NOT NULL, next_attempt_at INTEGER NOT NULL,
          lease_expires_at INTEGER, lease_token TEXT, platform_message_id TEXT, last_error TEXT,
          created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL, source_kind TEXT NOT NULL,
          codex_thread_id TEXT, codex_turn_id TEXT, ingress_producer TEXT NOT NULL,
          producer_version TEXT NOT NULL, protocol_version INTEGER NOT NULL
        ) STRICT;
        INSERT INTO outbound_notifications VALUES (
          'n1','k1','telegram','/tmp','Title','Body','queued',0,1,NULL,NULL,NULL,NULL,1,1,
          'notification_only',NULL,NULL,'mcp','0.1.0',1
        );
        CREATE TABLE thread_watches (id TEXT);
        CREATE TABLE context_state (id TEXT);
      `);
      legacy.close();
      const migrated = new GatewayDatabase(path);
      expect(tableNames(migrated)).toEqual(["outbound_notifications", "schema_migrations"]);
      expect(
        migrated.connection.prepare("SELECT title, message FROM outbound_notifications").get(),
      ).toEqual({ title: "Title", message: "Body" });
      migrated.close();
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }
  });
});

function tableNames(database: GatewayDatabase): string[] {
  return (
    database.connection
      .prepare("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name")
      .all() as Array<{ name: string }>
  ).map((row) => row.name);
}
