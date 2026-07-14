const TELEGRAM_RICH_MARKDOWN_LIMIT = 32_768;
const MARKDOWN_SPECIAL = /([\\`*_{}[\]()#+\-.!|>])/g;

export function escapeRichMarkdownText(value: string): string {
  return value.replace(MARKDOWN_SPECIAL, "\\$1");
}

export function prepareRichMarkdownParts(
  value: string,
  limit = TELEGRAM_RICH_MARKDOWN_LIMIT,
): readonly string[] {
  const normalized = value.replaceAll("\r\n", "\n").trim();
  if (!normalized) return [""];
  if (limit <= 0) throw new Error("Rich Markdown limit must be positive");

  const parts: string[] = [];
  let remaining = normalized;
  while (remaining.length > limit) {
    const boundary = findBoundary(remaining, limit);
    parts.push(remaining.slice(0, boundary).trimEnd());
    remaining = remaining.slice(boundary).trimStart();
  }
  parts.push(remaining);
  return parts;
}

function findBoundary(value: string, limit: number): number {
  for (const separator of ["\n\n", "\n", " "]) {
    const boundary = value.lastIndexOf(separator, limit);
    if (boundary > limit / 2) return boundary + separator.length;
  }
  return limit;
}
