import { z } from "zod";

const environmentSchema = z.object({
  TELEGRAM_BOT_TOKEN: z.string().min(1),
  TELEGRAM_ALLOWED_CHAT_ID: z.coerce.number().int().positive().max(Number.MAX_SAFE_INTEGER),
  CODEX_IM_DISPATCH_INTERVAL_MS: z.coerce.number().int().min(100).default(1_000),
});

export interface RuntimeConfig {
  readonly telegramBotToken: string;
  readonly telegramChatId: number;
  readonly dispatchIntervalMs: number;
}

export function loadRuntimeConfig(env: NodeJS.ProcessEnv = process.env): RuntimeConfig {
  const parsed = environmentSchema.parse(env);
  return {
    telegramBotToken: parsed.TELEGRAM_BOT_TOKEN,
    telegramChatId: parsed.TELEGRAM_ALLOWED_CHAT_ID,
    dispatchIntervalMs: parsed.CODEX_IM_DISPATCH_INTERVAL_MS,
  };
}
