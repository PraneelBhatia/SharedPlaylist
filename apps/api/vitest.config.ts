import { defineConfig } from "vitest/config";
import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";

// Load workspace-root .env so tests pick up DATABASE_URL, REDIS_URL, TOKEN_ENCRYPTION_KEY, etc.
const envPath = resolve(__dirname, "../../.env");
if (existsSync(envPath)) {
  for (const rawLine of readFileSync(envPath, "utf8").split("\n")) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const eq = line.indexOf("=");
    if (eq === -1) continue;
    const key = line.slice(0, eq).trim();
    const value = line.slice(eq + 1).trim().replace(/^['"]|['"]$/g, "");
    // Later lines override earlier ones, matching dotenv-with-overrides behaviour.
    process.env[key] = value;
  }
}

export default defineConfig({
  test: {
    environment: "node",
    // Tests share a single Postgres database and cleanup() truncates between
    // each test. Running files in parallel causes one suite's cleanup to wipe
    // another suite's seed data mid-test. Serialize file execution to keep the
    // suite stable.
    fileParallelism: false,
  },
});
