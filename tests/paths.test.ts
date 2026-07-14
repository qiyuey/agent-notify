import { homedir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { resolveDatabasePath, resolveDataDirectory } from "../src/config/paths.js";

describe("runtime paths", () => {
  it("uses the private default data directory", () => {
    expect(resolveDataDirectory({})).toBe(join(homedir(), ".local", "share", "codex-im"));
  });

  it("accepts an explicit data directory", () => {
    expect(resolveDatabasePath({ CODEX_IM_DATA_DIR: "/tmp/codex-im-test" })).toBe(
      "/tmp/codex-im-test/gateway.sqlite",
    );
  });
});
