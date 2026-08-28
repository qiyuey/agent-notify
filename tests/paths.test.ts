import { describe, expect, it } from "vitest";
import { resolveDatabasePath, resolveDataDirectory } from "../src/config/paths.js";

describe("runtime paths", () => {
  it("accepts an explicit data directory", () => {
    expect(resolveDatabasePath({ AGENT_NOTIFY_DATA_DIR: "/tmp/agent-notify-test" })).toBe(
      "/tmp/agent-notify-test/notifications.sqlite",
    );
  });

  it("accepts the legacy data directory variable", () => {
    expect(resolveDataDirectory({ CODEX_IM_DATA_DIR: "/tmp/codex-im-test" })).toBe(
      "/tmp/codex-im-test",
    );
  });
});
