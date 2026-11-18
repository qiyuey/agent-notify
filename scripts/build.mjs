import { chmod, copyFile, cp, mkdir, rm } from "node:fs/promises";
import { build } from "esbuild";

await rm("dist", { force: true, recursive: true });
await mkdir("dist", { recursive: true });

await build({
  banner: {
    js: 'import { createRequire as __createRequire } from "node:module"; const require = __createRequire(import.meta.url);',
  },
  bundle: true,
  entryPoints: {
    cli: "src/cli.ts",
    daemon: "src/daemon.ts",
    "mcp/server": "src/mcp/server.ts",
  },
  format: "esm",
  logLevel: "info",
  outdir: "dist",
  platform: "node",
  sourcemap: true,
  target: "node26",
});

await chmod("dist/cli.js", 0o755);
await chmod("dist/daemon.js", 0o755);

await rm("artifacts", { force: true, recursive: true });
await Promise.all([
  mkdir("artifacts/agent-notify/dist", { recursive: true }),
  mkdir("artifacts/runtime/dist", { recursive: true }),
]);
await Promise.all([
  copyFile("plugin.json", "artifacts/agent-notify/plugin.json"),
  copyFile("mcp.json", "artifacts/agent-notify/mcp.json"),
  cp("skills", "artifacts/agent-notify/skills", { recursive: true }),
  cp("dist/mcp", "artifacts/agent-notify/dist/mcp", { recursive: true }),
  copyFile("LICENSE", "artifacts/agent-notify/LICENSE"),
  copyFile("dist/daemon.js", "artifacts/runtime/dist/daemon.js"),
  copyFile("dist/daemon.js.map", "artifacts/runtime/dist/daemon.js.map"),
  copyFile("dist/cli.js", "artifacts/runtime/dist/cli.js"),
  copyFile("dist/cli.js.map", "artifacts/runtime/dist/cli.js.map"),
  copyFile(".env.example", "artifacts/runtime/.env.example"),
  copyFile("LICENSE", "artifacts/runtime/LICENSE"),
  copyFile("README.md", "artifacts/runtime/README.md"),
]);

await Promise.all([
  chmod("artifacts/runtime/dist/daemon.js", 0o755),
  chmod("artifacts/runtime/dist/cli.js", 0o755),
]);
