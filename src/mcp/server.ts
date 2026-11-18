import { McpServer } from "@modelcontextprotocol/server";
import { serveStdio } from "@modelcontextprotocol/server/stdio";
import { z } from "zod";
import { enqueueNotification } from "../application/enqueue-notification.js";
import { AGENT_NOTIFY_RUNTIME_VERSION } from "../core/build-info.js";
import { notificationStates } from "../core/types.js";

serveStdio(() => {
  const server = new McpServer(
    { name: "agent-notify", version: AGENT_NOTIFY_RUNTIME_VERSION },
    { capabilities: { tools: {} } },
  );

  server.registerTool(
    "deliver_notification",
    {
      description:
        "Durably queue one explicit result for asynchronous IM delivery. Use only when the user or task contract explicitly requests notification delivery.",
      annotations: {
        title: "Deliver notification",
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
        state: z.enum(notificationStates),
        duplicate: z.boolean(),
      }),
    },
    async ({ title, message, dedupeKey }) => {
      const result = enqueueNotification({
        title,
        message,
        ...(dedupeKey ? { dedupeKey } : {}),
      });
      return success({
        notificationId: result.notificationId,
        state: result.state,
        duplicate: result.duplicate,
      });
    },
  );
  return server;
});

function success<T extends Record<string, unknown>>(value: T) {
  return {
    content: [{ type: "text" as const, text: JSON.stringify(value) }],
    structuredContent: value,
  };
}
