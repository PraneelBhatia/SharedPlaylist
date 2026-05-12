import { describe, expect, it, vi } from "vitest";

vi.mock("../providers/index.ts", () => ({
  getProviderClient: () => ({
    findTrackByIsrc: async () => ({
      provider: "apple_music",
      id: "apple-1",
      title: "Same Song",
      artists: ["Artist"],
      isrc: "US123",
    }),
    searchTracks: async () => [],
  }),
}));

describe("matcher", () => {
  it("prefers ISRC matches", async () => {
    const { matchTrack } = await import("./matcher.ts");
    const match = await matchTrack(
      {
        provider: "spotify",
        id: "spotify-1",
        title: "Same Song",
        artists: ["Artist"],
        isrc: "US123",
      },
      "apple_music",
    );

    expect(match?.strategy).toBe("isrc");
    expect(match?.confidence).toBe(1);
  });
});
