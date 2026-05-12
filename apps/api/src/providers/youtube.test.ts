import { describe, expect, it, vi } from "vitest";

describe("YouTube provider", () => {
  it("is gated behind YOUTUBE_BETA_ENABLED", async () => {
    vi.stubEnv("DATABASE_URL", "postgresql://user:pass@localhost:5432/db");
    vi.stubEnv("REDIS_URL", "redis://localhost:6379");
    vi.stubEnv("TOKEN_ENCRYPTION_KEY", Buffer.alloc(32, 1).toString("base64"));
    vi.stubEnv("YOUTUBE_BETA_ENABLED", "false");

    const { getYoutubeAuthUrl } = await import("./youtube.ts");

    expect(() => getYoutubeAuthUrl()).toThrow("YouTube beta is disabled");
  });
});
