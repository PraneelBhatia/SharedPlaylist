import { describe, expect, it, vi } from "vitest";

describe("Apple Music provider", () => {
  it("treats 204 playlist writes as success", async () => {
    vi.stubEnv("DATABASE_URL", "postgresql://user:pass@localhost:5432/db");
    vi.stubEnv("REDIS_URL", "redis://localhost:6379");
    vi.stubEnv("TOKEN_ENCRYPTION_KEY", Buffer.alloc(32, 1).toString("base64"));
    vi.stubEnv("APPLE_DEVELOPER_TOKEN_OVERRIDE", "developer-token");

    const mod = await import("./apple-music.ts");
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(new Response(null, { status: 204 })),
    );

    await expect(
      mod.addAppleSongsToPlaylist(
        "",
        "playlist-id",
        [{ provider: "apple_music", id: "song-id", title: "Song", artists: ["Artist"] }],
        "music-user-token",
      ),
    ).resolves.toBeUndefined();
  });
});
