export interface Migration {
  readonly version: number;
  readonly name: string;
  readonly sql: string;
  readonly freshSql?: string;
}

const deliveryOnlyNotificationTable = `
  CREATE TABLE outbound_notifications (
    id TEXT PRIMARY KEY,
    idempotency_key TEXT NOT NULL UNIQUE,
    title TEXT NOT NULL,
    message TEXT NOT NULL,
    state TEXT NOT NULL CHECK (state IN ('queued', 'leased', 'delivered', 'dead_letter')),
    attempt_count INTEGER NOT NULL DEFAULT 0 CHECK (attempt_count >= 0),
    next_attempt_at INTEGER NOT NULL,
    lease_expires_at INTEGER,
    lease_token TEXT,
    telegram_message_id TEXT,
    last_error TEXT,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL,
    CHECK ((state = 'leased') = (lease_expires_at IS NOT NULL AND lease_token IS NOT NULL))
  ) STRICT;

  CREATE INDEX outbound_notifications_ready_idx
    ON outbound_notifications (state, next_attempt_at, created_at);
  CREATE INDEX outbound_notifications_lease_idx
    ON outbound_notifications (state, lease_expires_at);
`;

const notificationTable = deliveryOnlyNotificationTable
  .replace("id TEXT PRIMARY KEY,", "id TEXT PRIMARY KEY,\n    producer TEXT NOT NULL,")
  .replace("telegram_message_id TEXT", "provider_message_id TEXT");

export const migrations: readonly Migration[] = [
  {
    version: 10,
    name: "delivery_only",
    freshSql: deliveryOnlyNotificationTable,
    sql: `
      DROP TRIGGER IF EXISTS outbound_notification_source_insert_check;
      DROP TRIGGER IF EXISTS outbound_notification_source_update_check;
      DROP INDEX IF EXISTS outbound_notifications_ready_idx;
      DROP INDEX IF EXISTS outbound_notifications_lease_idx;

      ALTER TABLE outbound_notifications RENAME TO outbound_notifications_legacy;
      ${deliveryOnlyNotificationTable}
      INSERT INTO outbound_notifications (
        id, idempotency_key, title, message, state, attempt_count, next_attempt_at,
        lease_expires_at, lease_token, telegram_message_id, last_error, created_at, updated_at
      )
      SELECT
        id, idempotency_key, title, message, state, attempt_count, next_attempt_at,
        lease_expires_at, lease_token, platform_message_id, last_error, created_at, updated_at
      FROM outbound_notifications_legacy;
      DROP TABLE outbound_notifications_legacy;

      DROP TABLE IF EXISTS deliveries;
      DROP TABLE IF EXISTS completion_events;
      DROP TABLE IF EXISTS message_bindings;
      DROP TABLE IF EXISTS context_state;
      DROP TABLE IF EXISTS thread_metadata;
      DROP TABLE IF EXISTS thread_watches;
      DROP TABLE IF EXISTS terminal_deliveries;
      DROP TABLE IF EXISTS muted_threads;
      DROP TABLE IF EXISTS telegram_status_cards;
      DELETE FROM schema_migrations;
    `,
  },
  {
    version: 11,
    name: "agent_producers",
    freshSql: notificationTable,
    sql: `
      ALTER TABLE outbound_notifications ADD COLUMN producer TEXT NOT NULL DEFAULT 'codex';
      ALTER TABLE outbound_notifications RENAME COLUMN telegram_message_id TO provider_message_id;
    `,
  },
] as const;
