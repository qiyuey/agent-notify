import { deepStrictEqual } from "node:assert";
import { access, readFile, realpath } from "node:fs/promises";
import { isAbsolute, relative, resolve } from "node:path";

const manifest = JSON.parse(await readFile(".codex-plugin/plugin.json", "utf8"));
const mcpConfig = JSON.parse(await readFile(".mcp.json", "utf8"));
const packageJson = JSON.parse(await readFile("package.json", "utf8"));
const buildInfo = await readFile("src/core/build-info.ts", "utf8");
const deliverySkill = await readFile("skills/notification-delivery/SKILL.md", "utf8");
const builtMcpServer = await readFile("dist/mcp/server.js", "utf8");
const builtDaemon = await readFile("dist/daemon.js", "utf8");
const packagedManifest = JSON.parse(
  await readFile("artifacts/agent-notify/.codex-plugin/plugin.json", "utf8"),
);
const piPackage = JSON.parse(await readFile("artifacts/pi-package/package.json", "utf8"));
const builtPiExtension = await readFile("artifacts/pi-package/extensions/agent-notify.js", "utf8");

assert(manifest.name === "agent-notify", "manifest name must match the plugin directory");
assert(
  manifest.version.split("+")[0] === packageJson.version,
  "plugin and runtime base versions must match",
);
assert(
  buildInfo.includes(`AGENT_NOTIFY_RUNTIME_VERSION = "${packageJson.version}"`),
  "runtime build info version is stale",
);
assert(manifest.skills === "./skills/", "manifest must expose the delivery skill");
assert(manifest.mcpServers === "./.mcp.json", "manifest must expose the MCP server");
deepStrictEqual(Object.keys(mcpConfig.mcpServers), ["agent-notify"]);
const server = mcpConfig.mcpServers["agent-notify"];
assert(typeof server.command === "string" && server.command.length > 0, "MCP command is required");
assert(
  Array.isArray(server.args) && server.args.every((arg) => typeof arg === "string"),
  "MCP args must be strings",
);
assert(server.cwd === "" || server.cwd === ".", "MCP must launch from the plugin root");
deepStrictEqual(
  server.env_vars,
  ["PATH", "HOME"],
  "MCP should inherit only its runtime environment",
);
await assertPackagedPath(manifest.skills);
await assertPackagedPath(manifest.mcpServers);
assert(deliverySkill.includes("deliver_notification"), "delivery skill must name its only tool");
assert(builtMcpServer.includes("deliver_notification"), "built MCP server is missing delivery");
assert(builtPiExtension.includes("deliver_notification"), "Pi extension is missing delivery");
assert(piPackage.pi.extensions[0] === "./extensions", "Pi package must expose its extension");
assert(piPackage.pi.skills[0] === "./skills", "Pi package must expose its skill");
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
for (const [source, packaged] of [
  [".codex-plugin/plugin.json", "artifacts/agent-notify/.codex-plugin/plugin.json"],
  [".mcp.json", "artifacts/agent-notify/.mcp.json"],
  [
    "skills/notification-delivery/SKILL.md",
    "artifacts/agent-notify/skills/notification-delivery/SKILL.md",
  ],
  [
    "skills/notification-delivery/SKILL.md",
    "artifacts/pi-package/skills/notification-delivery/SKILL.md",
  ],
  ["dist/mcp/server.js", "artifacts/agent-notify/dist/mcp/server.js"],
  ["dist/daemon.js", "artifacts/runtime/dist/daemon.js"],
  ["dist/cli.js", "artifacts/runtime/dist/cli.js"],
  ["dist/pi/extension.js", "artifacts/pi-package/extensions/agent-notify.js"],
]) {
  deepStrictEqual(await readFile(packaged), await readFile(source), `${packaged} is stale`);
}
await Promise.all([
  access("artifacts/agent-notify/dist/mcp/server.js"),
  access("artifacts/pi-package/extensions/agent-notify.js"),
  access("artifacts/runtime/dist/daemon.js"),
  access("artifacts/runtime/dist/cli.js"),
]);
await Promise.all([
  assertMissing("hooks"),
  assertMissing("skills/gateway"),
  assertMissing("artifacts/agent-notify/hooks"),
  assertMissing("artifacts/agent-notify/dist/hooks"),
  assertMissing("artifacts/agent-notify/dist/daemon.js"),
  assertMissing("artifacts/agent-notify/dist/cli.js"),
  assertMissing("artifacts/agent-notify/dist/pi"),
]);

process.stdout.write("Agent delivery packages are valid.\n");

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

async function assertMissing(path) {
  try {
    await access(path);
  } catch (error) {
    if (error.code === "ENOENT") return;
    throw error;
  }
  throw new Error(`obsolete path remains: ${path}`);
}

async function assertPackagedPath(path) {
  assert(
    path.startsWith("./") && !path.split("/").includes(".."),
    "plugin paths must stay inside the package",
  );
  const root = await realpath("artifacts/agent-notify");
  const target = await realpath(resolve(root, path));
  const local = relative(root, target);
  assert(
    !isAbsolute(local) && local !== ".." && !local.startsWith("../"),
    "plugin path escapes the package",
  );
}
