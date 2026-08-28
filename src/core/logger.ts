export type LogLevel = "debug" | "info" | "warn" | "error";

export type LogFields = Readonly<Record<string, string | number | boolean | null>>;

export interface Logger {
  debug(event: string, fields?: LogFields): void;
  info(event: string, fields?: LogFields): void;
  warn(event: string, fields?: LogFields): void;
  error(event: string, fields?: LogFields): void;
}

const LEVEL_ORDER: Readonly<Record<LogLevel, number>> = {
  debug: 10,
  info: 20,
  warn: 30,
  error: 40,
};

export const DEFAULT_LOG_LEVEL: LogLevel = "info";

export function parseLogLevel(value: string | undefined): LogLevel {
  return value === "debug" || value === "info" || value === "warn" || value === "error"
    ? value
    : DEFAULT_LOG_LEVEL;
}

export interface LoggerOptions {
  readonly level?: LogLevel;
  readonly write?: (line: string, level: LogLevel) => void;
}

// launchd routes stdout and stderr to separate files, so only warn/error land in the error log.
function defaultWrite(line: string, level: LogLevel): void {
  if (level === "warn" || level === "error") process.stderr.write(line);
  else process.stdout.write(line);
}

export function createLogger(options: LoggerOptions = {}): Logger {
  const level =
    options.level ??
    parseLogLevel(process.env.AGENT_NOTIFY_LOG_LEVEL ?? process.env.CODEX_IM_LOG_LEVEL);
  const write = options.write ?? defaultWrite;
  const threshold = LEVEL_ORDER[level];

  const emit = (entryLevel: LogLevel, event: string, fields?: LogFields): void => {
    if (LEVEL_ORDER[entryLevel] < threshold) return;
    write(`${JSON.stringify({ level: entryLevel, event, ...redactFields(fields) })}\n`, entryLevel);
  };

  return {
    debug: (event, fields) => emit("debug", event, fields),
    info: (event, fields) => emit("info", event, fields),
    warn: (event, fields) => emit("warn", event, fields),
    error: (event, fields) => emit("error", event, fields),
  };
}

/** Discards every entry. Used by short-lived hook processes and tests. */
export const silentLogger: Logger = {
  debug: () => undefined,
  info: () => undefined,
  warn: () => undefined,
  error: () => undefined,
};

export function describeError(error: unknown): { readonly kind: string; readonly message: string } {
  if (error instanceof Error) {
    return { kind: error.name, message: redactSecrets(error.message).slice(0, 500) };
  }
  return { kind: "UnknownError", message: "unknown error" };
}

export function redactSecrets(message: string): string {
  return (
    message
      .replace(/\b(bearer)\s+[a-z0-9._~+/=-]+/gi, "$1 [REDACTED]")
      .replace(/\b(token|api[_-]?key|password|secret)\s*[=:]\s*[^\s,;]+/gi, "$1=[REDACTED]")
      // Telegram bot tokens leak through request URLs as `/bot<digits>:<secret>/`,
      // so the digits are not preceded by a word boundary.
      .replace(/(?<!\d)\d{6,}:[A-Za-z0-9_-]{30,}(?![A-Za-z0-9_-])/g, "[REDACTED]")
  );
}

function redactFields(fields: LogFields | undefined): LogFields {
  if (!fields) return {};
  const result: Record<string, string | number | boolean | null> = {};
  for (const [key, value] of Object.entries(fields)) {
    result[key] = typeof value === "string" ? redactSecrets(value) : value;
  }
  return result;
}
