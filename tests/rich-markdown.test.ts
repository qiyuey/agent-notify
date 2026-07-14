import { describe, expect, it } from "vitest";
import { escapeRichMarkdownText, prepareRichMarkdownParts } from "../src/telegram/rich-markdown.js";

describe("Rich Markdown preparation", () => {
  it("escapes untrusted heading text", () => {
    expect(escapeRichMarkdownText("[report] #1")).toBe("\\[report\\] \\#1");
  });

  it("normalizes, trims, and preserves short content", () => {
    expect(prepareRichMarkdownParts("  a\r\n\r\nb  ")).toEqual(["a\n\nb"]);
  });

  it("splits at paragraphs, lines, words, then hard limits", () => {
    expect(prepareRichMarkdownParts("aaaa\n\nbbbb", 7)).toEqual(["aaaa", "bbbb"]);
    expect(prepareRichMarkdownParts("aaaa\nbbbb", 7)).toEqual(["aaaa", "bbbb"]);
    expect(prepareRichMarkdownParts("aaaa bbbb", 7)).toEqual(["aaaa", "bbbb"]);
    expect(prepareRichMarkdownParts("aaaabbbb", 4)).toEqual(["aaaa", "bbbb"]);
  });

  it("handles empty content and rejects invalid limits", () => {
    expect(prepareRichMarkdownParts("   ")).toEqual([""]);
    expect(() => prepareRichMarkdownParts("x", 0)).toThrow(/positive/);
  });
});
