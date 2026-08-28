import { spawnSync } from "node:child_process";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

const env = { ...process.env };
delete env.TELEGRAM_BOT_TOKEN;
delete env.TELEGRAM_ALLOWED_CHAT_ID;

const result = spawnSync(process.execPath, ["dist/daemon.js"], {
  cwd: process.cwd(),
  encoding: "utf8",
  env,
});

if (result.status !== 1 || !result.stderr.includes('"event":"delivery_crashed"')) {
  process.stderr.write(result.stdout);
  process.stderr.write(result.stderr);
  throw new Error("Built daemon did not reach runtime configuration validation");
}

if (result.stderr.includes("Dynamic require")) {
  throw new Error("Built daemon contains an unusable dynamic require shim");
}

const directory = await mkdtemp(join(tmpdir(), "agent-notify-pi-smoke-"));
try {
  process.env.AGENT_NOTIFY_DATA_DIR = directory;
  const tools = [];
  const { default: registerPiExtension } = await import("../dist/pi/extension.js");
  registerPiExtension({ registerTool: (tool) => tools.push(tool) });
  const tool = tools[0];
  if (tool?.name !== "deliver_notification") throw new Error("Built Pi tool was not registered");
  const delivery = await tool.execute("smoke-call", { title: "Smoke", message: "Passed" });
  if (!delivery.content[0]?.text.includes('"state":"queued"')) {
    throw new Error("Built Pi tool did not enqueue a notification");
  }
} finally {
  delete process.env.AGENT_NOTIFY_DATA_DIR;
  await rm(directory, { force: true, recursive: true });
}

process.stdout.write("Built daemon and Pi extension smoke tests passed.\n");
