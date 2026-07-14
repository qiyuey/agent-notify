import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    coverage: {
      include: ["src/**/*.ts"],
      exclude: [
        "src/cli.ts",
        "src/daemon.ts",
        "src/mcp/server.ts",
        "src/application/health.ts",
        "src/runtime/create-delivery-application.ts",
        "src/runtime/launchd-service.ts",
        "src/telegram/telegram-client.ts",
      ],
      provider: "v8",
      thresholds: {
        branches: 70,
        functions: 78,
        lines: 78,
        statements: 75,
      },
    },
    environment: "node",
    include: ["tests/**/*.test.ts"],
  },
});
