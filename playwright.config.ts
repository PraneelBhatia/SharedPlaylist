import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  workers: 1,
  retries: 0,
  use: {
    baseURL: "http://127.0.0.1:3000",
    trace: "on-first-retry",
    screenshot: "only-on-failure",
  },
  webServer: [
    {
      // Load workspace-root .env so DATABASE_URL/REDIS_URL/TOKEN_ENCRYPTION_KEY
      // are present when the API dev server starts under Playwright.
      command:
        "set -a && . ./.env && set +a && pnpm --filter @sharedplaylist/api dev",
      url: "http://127.0.0.1:4000/v1/shares/_health",
      reuseExistingServer: true,
      timeout: 120_000,
    },
    {
      command: "pnpm --filter @sharedplaylist/web dev",
      url: "http://127.0.0.1:3000",
      reuseExistingServer: true,
      timeout: 120_000,
    },
  ],
});
