import assert from "node:assert/strict";
import { cp, mkdir, mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { test } from "node:test";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";

const packageRoot = resolve("artifacts/agent-notify");
const runtime = JSON.parse(await readFile("package.json", "utf8"));
const requestOptions = { timeout: 5_000 };
const payload = { title: "MCP integration", message: "**Verified**", dedupeKey: "run-1" };

// Use a relocated package, with no repository dependencies or live delivery configuration.
async function fixture(t) {
  const root = await mkdtemp(join(tmpdir(), "agent-notify-mcp-"));
  const clients = [];
  t.after(async () => {
    try {
      await Promise.all(clients.map((client) => client.close()));
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });
  const pluginRoot = join(root, "plugin with spaces");
  const dataRoot = join(root, "data");
  await cp(packageRoot, pluginRoot, { recursive: true });
  const config = JSON.parse(await readFile(join(pluginRoot, ".mcp.json"), "utf8"));
  const server = config.mcpServers["agent-notify"];

  async function connect() {
    const env = Object.fromEntries(
      (server.env_vars ?? [])
        .filter((name) => process.env[name] !== undefined)
        .map((name) => [name, process.env[name]]),
    );
    env.AGENT_NOTIFY_DATA_DIR = dataRoot;
    const transport = new StdioClientTransport({
      command: server.command,
      args: server.args,
      cwd: resolve(pluginRoot, server.cwd ?? "."),
      env,
      stderr: "pipe",
    });
    transport.stderr?.on("data", () => {});
    const client = new Client({ name: "agent-notify-integration", version: "1.0.0" });
    clients.push(client);
    await client.connect(transport, requestOptions);
    return client;
  }

  function rows() {
    const database = new DatabaseSync(join(dataRoot, "notifications.sqlite"), { readOnly: true });
    try {
      return database.prepare("SELECT * FROM outbound_notifications ORDER BY created_at").all();
    } finally {
      database.close();
    }
  }

  return { connect, rows, dataRoot };
}

function call(client, args) {
  return client.callTool(
    { name: "deliver_notification", arguments: args },
    undefined,
    requestOptions,
  );
}

test("packaged MCP initializes and exposes the notification contract", async (t) => {
  const { connect } = await fixture(t);
  const client = await connect();
  assert.deepEqual(client.getServerVersion(), { name: "agent-notify", version: runtime.version });
  const { tools } = await client.listTools({}, requestOptions);
  assert.deepEqual(
    tools.map((tool) => tool.name),
    ["deliver_notification"],
  );
  assert.deepEqual(tools[0].inputSchema.required, ["title", "message"]);
  assert.deepEqual(tools[0].outputSchema.properties.state.enum, [
    "queued",
    "leased",
    "delivered",
    "dead_letter",
  ]);
  assert.equal(tools[0].annotations.readOnlyHint, false);
  assert.equal(tools[0].annotations.idempotentHint, false);
});

test("MCP enqueue persists and deduplicates across server restarts", async (t) => {
  const { connect, rows } = await fixture(t);
  const firstClient = await connect();
  const first = await call(firstClient, payload);
  assert.equal(first.isError, undefined);
  assert.equal(first.structuredContent.state, "queued");
  assert.equal(first.structuredContent.duplicate, false);
  assert.deepEqual(JSON.parse(first.content[0].text), first.structuredContent);
  await firstClient.close();

  const client = await connect();
  const duplicate = await call(client, payload);
  assert.deepEqual(duplicate.structuredContent, { ...first.structuredContent, duplicate: true });
  assert.equal(rows().length, 1);
  assert.equal(rows()[0].producer, "codex");
  assert.equal(rows()[0].message, payload.message);
  assert.equal(rows()[0].state, "queued");

  const { dedupeKey: _key, ...withoutKey } = payload;
  const second = await call(client, withoutKey);
  const third = await call(client, withoutKey);
  assert.notEqual(second.structuredContent.notificationId, third.structuredContent.notificationId);
  assert.equal(rows().length, 3);
});

test("invalid MCP inputs return tool errors without adding notifications", async (t) => {
  const { connect, rows } = await fixture(t);
  const client = await connect();
  await call(client, payload);
  for (const args of [
    { message: "Missing title" },
    { ...payload, title: "" },
    { ...payload, title: "x".repeat(201) },
    { ...payload, message: "x".repeat(12_001) },
    { ...payload, dedupeKey: "x".repeat(257) },
    { ...payload, title: "unsafe\0title" },
  ]) {
    const result = await call(client, args);
    assert.equal(result.isError, true);
    assert.equal(result.structuredContent, undefined);
  }
  assert.equal(rows().length, 1);
  const recovery = await call(client, { ...payload, dedupeKey: "valid-after-errors" });
  assert.equal(recovery.structuredContent.state, "queued");
  assert.equal(rows().length, 2);
});

test("duplicate responses preserve the existing delivery state", async (t) => {
  const { connect, dataRoot, rows } = await fixture(t);
  const client = await connect();
  const first = await call(client, payload);
  const database = new DatabaseSync(join(dataRoot, "notifications.sqlite"));
  try {
    for (const state of ["leased", "delivered", "dead_letter"]) {
      database
        .prepare(
          "UPDATE outbound_notifications SET state = ?, lease_expires_at = ?, lease_token = ? WHERE id = ?",
        )
        .run(
          state,
          state === "leased" ? Date.now() + 60_000 : null,
          state === "leased" ? "test-lease" : null,
          first.structuredContent.notificationId,
        );
      const duplicate = await call(client, payload);
      assert.deepEqual(duplicate.structuredContent, {
        ...first.structuredContent,
        state,
        duplicate: true,
      });
      assert.equal(rows().length, 1);
    }
  } finally {
    database.close();
  }
});

test("storage failures are tool errors and the MCP process can recover", async (t) => {
  const { connect, dataRoot, rows } = await fixture(t);
  const databasePath = join(dataRoot, "notifications.sqlite");
  await mkdir(databasePath, { recursive: true });
  const client = await connect();
  const failure = await call(client, payload);
  assert.equal(failure.isError, true);
  assert.equal(failure.structuredContent, undefined);
  await rm(databasePath, { recursive: true });
  const success = await call(client, payload);
  assert.equal(success.structuredContent.state, "queued");
  assert.equal(rows().length, 1);
});
