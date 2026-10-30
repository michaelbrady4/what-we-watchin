import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    fileParallelism: false,
    exclude: ["**/node_modules/**", "e2e/**", ".next/**"],
    testTimeout: 20_000,
    hookTimeout: 30_000,
    env: {
      DATABASE_URL: "postgres://postgres:postgres@127.0.0.1:5432/watchin",
      SPIN_WINDOW_MS: "5000",
    },
  },
});
