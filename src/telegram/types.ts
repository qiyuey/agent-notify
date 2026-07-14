export interface TelegramApi {
  sendRichMessage(chatId: number, markdown: string): Promise<{ readonly messageId: string }>;
}
