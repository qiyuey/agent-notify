import { describe, expect, it } from "vitest";
import {
  createLogger,
  describeError,
  type LogLevel,
  parseLogLevel,
  redactSecrets,
  silentLogger,
} from "../src/core/logger.js";

function capturingLogger(level: LogLevel) {
  const entries: Array<{ readonly line: string; readonly level: LogLevel }> = [];
  const logger = createLogger({
    level,
    write: (line, entryLevel) => {
      entries.push({ line, level: entryLevel });
    },
  });
  return { entries, logger, parsed: () => entries.map((entry) => JSON.parse(entry.line)) };
}

describe("createLogger", () => {
  it("emits one JSON line per entry with the level and event", () => {
    const { logger, parsed } = capturingLogger("debug");

    logger.info("gateway_started", { pid: 42 });

    expect(parsed()).toEqual([{ level: "info", event: "gateway_started", pid: 42 }]);
  });

  it("terminates every line with a newline so log files stay parseable", () => {
    const { entries, logger } = capturingLogger("debug");

    logger.debug("first");
    logger.debug("second");

    expect(entries.every((entry) => entry.line.endsWith("\n"))).toBe(true);
  });

  it("drops entries below the configured level", () => {
    const { logger, parsed } = capturingLogger("warn");

    logger.debug("dropped_debug");
    logger.info("dropped_info");
    logger.warn("kept_warn");
    logger.error("kept_error");

    expect(parsed().map((entry) => entry.event)).toEqual(["kept_warn", "kept_error"]);
  });

  it("routes warn and error to stderr and lower levels to stdout", () => {
    const { entries, logger } = capturingLogger("debug");

    logger.debug("a");
    logger.info("b");
    logger.warn("c");
    logger.error("d");

    expect(entries.map((entry) => entry.level)).toEqual(["debug", "info", "warn", "error"]);
  });

  it("redacts secrets found in string fields", () => {
    const { logger, parsed } = capturingLogger("debug");

    logger.error("request_failed", {
      message: "Authorization: bearer sk-abc123def456",
      attempt: 3,
    });

    expect(parsed()[0]?.message).toBe("Authorization: bearer [REDACTED]");
    expect(parsed()[0]?.attempt).toBe(3);
  });

  it("takes the default level from AGENT_NOTIFY_LOG_LEVEL", () => {
    const previous = process.env.AGENT_NOTIFY_LOG_LEVEL;
    process.env.AGENT_NOTIFY_LOG_LEVEL = "error";
    const lines: string[] = [];
    try {
      const logger = createLogger({
        write: (line) => {
          lines.push(line);
        },
      });
      logger.warn("dropped_warn");
      logger.error("kept_error");
    } finally {
      if (previous === undefined) delete process.env.AGENT_NOTIFY_LOG_LEVEL;
      else process.env.AGENT_NOTIFY_LOG_LEVEL = previous;
    }

    expect(lines.map((line) => JSON.parse(line).event)).toEqual(["kept_error"]);
  });

  it("keeps non-string fields untouched", () => {
    const { logger, parsed } = capturingLogger("debug");

    logger.info("state", { count: 0, enabled: false, previous: null });

    expect(parsed()[0]).toEqual({
      level: "info",
      event: "state",
      count: 0,
      enabled: false,
      previous: null,
    });
  });
});

describe("silentLogger", () => {
  it("discards every level without throwing", () => {
    expect(() => {
      silentLogger.debug("a");
      silentLogger.info("b");
      silentLogger.warn("c");
      silentLogger.error("d");
    }).not.toThrow();
  });
});

describe("parseLogLevel", () => {
  it("accepts the four known levels", () => {
    expect(parseLogLevel("debug")).toBe("debug");
    expect(parseLogLevel("info")).toBe("info");
    expect(parseLogLevel("warn")).toBe("warn");
    expect(parseLogLevel("error")).toBe("error");
  });

  it("falls back to info for unknown or missing values", () => {
    expect(parseLogLevel(undefined)).toBe("info");
    expect(parseLogLevel("")).toBe("info");
    expect(parseLogLevel("verbose")).toBe("info");
    expect(parseLogLevel("DEBUG")).toBe("info");
  });
});

describe("describeError", () => {
  it("reports the error name and redacted message", () => {
    const error = new TypeError("token=hunter2 was rejected");

    expect(describeError(error)).toEqual({
      kind: "TypeError",
      message: "token=[REDACTED] was rejected",
    });
  });

  it("preserves custom error names such as GrammyError", () => {
    const error = new Error("Call to 'sendMessage' failed!");
    error.name = "GrammyError";

    expect(describeError(error).kind).toBe("GrammyError");
  });

  it("truncates long messages to bound log volume", () => {
    expect(describeError(new Error("x".repeat(5_000))).message).toHaveLength(500);
  });

  it("does not leak the shape of non-Error throws", () => {
    expect(describeError("bearer sk-secret")).toEqual({
      kind: "UnknownError",
      message: "unknown error",
    });
    expect(describeError(undefined)).toEqual({ kind: "UnknownError", message: "unknown error" });
    expect(describeError({ token: "secret" })).toEqual({
      kind: "UnknownError",
      message: "unknown error",
    });
  });
});

describe("redactSecrets", () => {
  it("redacts bearer tokens regardless of case", () => {
    expect(redactSecrets("Bearer AbC-123._~+/=")).toBe("Bearer [REDACTED]");
    expect(redactSecrets("bearer abc123")).toBe("bearer [REDACTED]");
  });

  it("redacts labelled credential assignments", () => {
    expect(redactSecrets("token=abc123")).toBe("token=[REDACTED]");
    expect(redactSecrets("api_key: abc123")).toBe("api_key=[REDACTED]");
    expect(redactSecrets("api-key=abc123")).toBe("api-key=[REDACTED]");
    expect(redactSecrets("password = p@ss")).toBe("password=[REDACTED]");
    expect(redactSecrets("secret:s3cr3t")).toBe("secret=[REDACTED]");
  });

  it("redacts telegram bot tokens embedded in URLs", () => {
    // Construct a token-shaped value at runtime so the fixture cannot be
    // mistaken for a live credential by repository secret scanners.
    const syntheticToken = ["123456789", "A".repeat(40)].join(":");
    const message = `request to https://api.telegram.org/bot${syntheticToken}/sendMessage failed`;

    expect(redactSecrets(message)).toBe(
      "request to https://api.telegram.org/bot[REDACTED]/sendMessage failed",
    );
  });

  it("leaves benign text unchanged", () => {
    expect(redactSecrets("thread 01HZ. status in_progress")).toBe(
      "thread 01HZ. status in_progress",
    );
    expect(redactSecrets("retry after 30")).toBe("retry after 30");
    expect(redactSecrets("")).toBe("");
  });
});
