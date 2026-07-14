import { access, readFile } from "node:fs/promises";

const manifest = JSON.parse(await readFile(".codex-plugin/plugin.json", "utf8"));
const mcpConfig = JSON.parse(await readFile(".mcp.json", "utf8"));
const packageJson = JSON.parse(await readFile("package.json", "utf8"));
const buildInfo = await readFile("src/core/build-info.ts", "utf8");
const deliverySkill = await readFile("skills/telegram-delivery/SKILL.md", "utf8");
const builtMcpServer = await readFile("dist/mcp/server.js", "utf8");
const builtDaemon = await readFile("dist/daemon.js", "utf8");
const packagedManifest = JSON.parse(
  await readFile("artifacts/plugin/.codex-plugin/plugin.json", "utf8"),
);

assert(manifest.name === "codex-im", "manifest name must match the plugin directory");
assert(
  manifest.version.split("+")[0] === packageJson.version,
  "plugin and runtime base versions must match",
);
assert(
  buildInfo.includes(`GATEWAY_RUNTIME_VERSION = "${packageJson.version}"`),
  "runtime build info version is stale",
);
assert(manifest.skills === "./skills/", "manifest must expose the delivery skill");
assert(manifest.mcpServers === "./.mcp.json", "manifest must expose the MCP server");
assert(
  JSON.stringify(mcpConfig) ===
    JSON.stringify({
      mcpServers: {
        gateway: {
          command: "/usr/bin/env",
          args: ["node", "./dist/mcp/server.js"],
          cwd: "",
          env_vars: ["PATH", "HOME"],
        },
      },
    }),
  "MCP companion config is invalid",
);
assert(deliverySkill.includes("telegram_deliver"), "delivery skill must name its only tool");
assert(deliverySkill.includes("exactly once"), "delivery skill must require one enqueue");
assert(builtMcpServer.includes("telegram_deliver"), "built MCP server is missing delivery");
for (const forbidden of [
  "gateway_enqueue",
  "gateway_list_events",
  "thread/resume",
  "TelegramService",
]) {
  assert(!builtMcpServer.includes(forbidden), `built MCP server contains ${forbidden}`);
  assert(!builtDaemon.includes(forbidden), `built daemon contains ${forbidden}`);
}
assert(packagedManifest.version === manifest.version, "packaged plugin version is stale");
await Promise.all([
  access("artifacts/plugin/dist/mcp/server.js"),
  access("artifacts/runtime/dist/daemon.js"),
  access("artifacts/runtime/dist/cli.js"),
]);
await Promise.all([
  assertMissing("hooks"),
  assertMissing("skills/gateway"),
  assertMissing("artifacts/plugin/hooks"),
  assertMissing("artifacts/plugin/dist/hooks"),
]);

process.stdout.write("Delivery-only plugin structure is valid.\n");

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

async function assertMissing(path) {
  try {
    await access(path);
  } catch {
    return;
  }
  throw new Error(`obsolete path remains: ${path}`);
}
