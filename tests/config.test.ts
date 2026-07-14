import { describe, expect, it } from "vitest";
import { loadRuntimeConfig } from "../src/config/runtime-config.js";

describe("runtime config", () => {
  it("loads only outbound delivery settings", () => {
    expect(
      loadRuntimeConfig({
        TELEGRAM_BOT_TOKEN: "token",
        TELEGRAM_ALLOWED_CHAT_ID: "42",
      }),
    ).toEqual({
      telegramBotToken: "token",
      telegramChatId: 42,
      dispatchIntervalMs: 1_000,
    });
  });

  it("rejects an invalid target chat", () => {
    expect(() =>
      loadRuntimeConfig({ TELEGRAM_BOT_TOKEN: "token", TELEGRAM_ALLOWED_CHAT_ID: "0" }),
    ).toThrow();
  });
});
