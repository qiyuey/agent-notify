import { randomUUID } from "node:crypto";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { openNotificationStore } from "../storage/open-store.js";

const server = new McpServer({ name: "codex-im", version: "0.1.0" });

server.registerTool(
  "telegram_deliver",
  {
    description:
      "Durably queue one explicit result for asynchronous Telegram delivery. Use only when the user or task contract explicitly requests Telegram delivery.",
    annotations: {
      title: "Deliver to Telegram",
      readOnlyHint: false,
      destructiveHint: false,
      idempotentHint: false,
      openWorldHint: true,
    },
    inputSchema: z.object({
      title: z.string().min(1).max(200),
      message: z.string().min(1).max(12_000),
      dedupeKey: z.string().min(1).max(256).optional(),
    }),
    outputSchema: z.object({
      notificationId: z.string(),
      state: z.string(),
      duplicate: z.boolean(),
    }),
  },
  async ({ title, message, dedupeKey }) => {
    const context = openNotificationStore();
    try {
      const idempotencyKey = `explicit:${dedupeKey ?? randomUUID()}`;
      const duplicate = context.store.findByIdempotencyKey(idempotencyKey) !== null;
      const notification = context.store.enqueue({ idempotencyKey, title, message });
      return success({ notificationId: notification.id, state: notification.state, duplicate });
    } finally {
      context.database.close();
    }
  },
);

function success<T extends Record<string, unknown>>(value: T) {
  return {
    content: [{ type: "text" as const, text: JSON.stringify(value) }],
    structuredContent: value,
  };
}

await server.connect(new StdioServerTransport());
