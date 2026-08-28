import { chmod, copyFile, cp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
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
    "pi/extension": "src/pi/extension.ts",
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
  mkdir("artifacts/pi-package/extensions", { recursive: true }),
  mkdir("artifacts/runtime/dist", { recursive: true }),
]);
await Promise.all([
  cp(".codex-plugin", "artifacts/agent-notify/.codex-plugin", { recursive: true }),
  copyFile(".mcp.json", "artifacts/agent-notify/.mcp.json"),
  cp("skills", "artifacts/agent-notify/skills", { recursive: true }),
  cp("dist/mcp", "artifacts/agent-notify/dist/mcp", { recursive: true }),
  copyFile("LICENSE", "artifacts/agent-notify/LICENSE"),
  copyFile("dist/pi/extension.js", "artifacts/pi-package/extensions/agent-notify.js"),
  copyFile("dist/pi/extension.js.map", "artifacts/pi-package/extensions/agent-notify.js.map"),
  cp("skills", "artifacts/pi-package/skills", { recursive: true }),
  copyFile("LICENSE", "artifacts/pi-package/LICENSE"),
  copyFile("dist/daemon.js", "artifacts/runtime/dist/daemon.js"),
  copyFile("dist/daemon.js.map", "artifacts/runtime/dist/daemon.js.map"),
  copyFile("dist/cli.js", "artifacts/runtime/dist/cli.js"),
  copyFile("dist/cli.js.map", "artifacts/runtime/dist/cli.js.map"),
  copyFile(".env.example", "artifacts/runtime/.env.example"),
  copyFile("LICENSE", "artifacts/runtime/LICENSE"),
  copyFile("README.md", "artifacts/runtime/README.md"),
]);

const packageJson = JSON.parse(await readFile("package.json", "utf8"));
await writeFile(
  "artifacts/pi-package/package.json",
  `${JSON.stringify(
    {
      name: packageJson.name,
      version: packageJson.version,
      description: packageJson.description,
      license: packageJson.license,
      keywords: packageJson.keywords,
      pi: { extensions: ["./extensions"], skills: ["./skills"] },
    },
    null,
    2,
  )}\n`,
);
await Promise.all([
  chmod("artifacts/runtime/dist/daemon.js", 0o755),
  chmod("artifacts/runtime/dist/cli.js", 0o755),
]);
