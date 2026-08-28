import { enqueueNotification } from "../application/enqueue-notification.js";

interface PiExtensionApi {
  registerTool(tool: {
    readonly name: string;
    readonly label: string;
    readonly description: string;
    readonly parameters: object;
    execute(
      toolCallId: string,
      input: { readonly title: string; readonly message: string; readonly dedupeKey?: string },
    ): Promise<{ readonly content: readonly { readonly type: "text"; readonly text: string }[] }>;
  }): void;
}

const parameters = {
  type: "object",
  additionalProperties: false,
  required: ["title", "message"],
  properties: {
    title: { type: "string", minLength: 1, maxLength: 200 },
    message: { type: "string", minLength: 1, maxLength: 12_000 },
    dedupeKey: { type: "string", minLength: 1, maxLength: 256 },
  },
} as const;

export default function agentNotifyExtension(pi: PiExtensionApi): void {
  pi.registerTool({
    name: "deliver_notification",
    label: "Deliver notification",
    description:
      "Durably queue one explicit result for asynchronous IM delivery. Use only when the user or task contract explicitly requests notification delivery.",
    parameters,
    async execute(_toolCallId, input) {
      const result = enqueueNotification("pi", input);
      return { content: [{ type: "text", text: JSON.stringify(result) }] };
    },
  });
}
