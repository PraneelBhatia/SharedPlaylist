import { describe, expect, it, vi } from "vitest";
import { createDestinationPlaylistFor } from "./create-destination-playlist.ts";
import * as providers from "../providers/index.ts";
import * as tokens from "../sync/tokens.ts";

describe("createDestinationPlaylistFor", () => {
  it("calls the provider client with the source playlist name", async () => {
    vi.spyOn(tokens, "getConnectionTokens").mockResolvedValue({ accessToken: "tok", userToken: "ut" } as never);
    const createPlaylist = vi.fn().mockResolvedValue({ playlistId: "new_pl", name: "Road Trip Mix" });
    vi.spyOn(providers, "getProviderClient").mockReturnValue({ createPlaylist } as never);
    const result = await createDestinationPlaylistFor("user1", "Road Trip Mix", "apple_music");
    expect(result).toEqual({ playlistId: "new_pl", name: "Road Trip Mix" });
    expect(createPlaylist).toHaveBeenCalledWith("tok", "Road Trip Mix", "ut");
  });
});
