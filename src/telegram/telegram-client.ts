import { Bot } from "grammy";
import type { TelegramApi } from "./types.js";

export class TelegramClient implements TelegramApi {
  private readonly bot: Bot;

  constructor(token: string) {
    this.bot = new Bot(token);
  }

  async sendRichMessage(chatId: number, markdown: string): Promise<{ readonly messageId: string }> {
    const message = await this.bot.api.sendRichMessage(chatId, { markdown });
    return { messageId: String(message.message_id) };
  }
}
