import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Provider } from "@sharedplaylist/shared-types";
import { prisma } from "../db/prisma.ts";
import { syncPair } from "./sync-pair.ts";
import * as providers from "../providers/index.ts";
import * as tokens from "./tokens.ts";

describe("syncPair mesh fan-out (e2e)", () => {
  beforeEach(async () => {
    vi.restoreAllMocks();
    await prisma.shareInviteView.deleteMany();
    await prisma.syncEvent.deleteMany();
    await prisma.unmatchedTrack.deleteMany();
    await prisma.trackMapping.deleteMany();
    await prisma.playlistLink.deleteMany();
    await prisma.pairMember.deleteMany();
    await prisma.pair.deleteMany();
    await prisma.user.deleteMany();
  });

  it("propagates Alice's add to Bob and Carol (2 writes for 3-member share)", async () => {
    const alice = await prisma.user.create({ data: { email: "a@x.com", displayName: "A" } });
    const bob = await prisma.user.create({ data: { email: "b@x.com", displayName: "B" } });
    const carol = await prisma.user.create({ data: { email: "c@x.com", displayName: "C" } });
    const share = await prisma.pair.create({
      data: {
        status: "active",
        creatorId: alice.id,
        sourceProvider: "spotify",
        sourcePlaylistId: "alice_pl",
        sourcePlaylistName: "Mix",
        members: {
          create: [{ userId: alice.id }, { userId: bob.id }, { userId: carol.id }],
        },
        playlists: {
          create: [
            { userId: alice.id, provider: "spotify", playlistId: "alice_pl" },
            { userId: bob.id, provider: "apple_music", playlistId: "bob_pl" },
            { userId: carol.id, provider: "youtube", playlistId: "carol_pl" },
          ],
        },
      },
    });

    vi.spyOn(tokens, "getConnectionTokens").mockResolvedValue({
      accessToken: "tok",
      userToken: "user_tok",
    } as never);

    const addSpy = vi.fn().mockResolvedValue(undefined);
    vi.spyOn(providers, "getProviderClient").mockImplementation((p: Provider) => ({
      provider: p,
      listPlaylists: async () => [],
      getPlaylistSnapshot: async () => ({ cursor: "s2" }),
      listPlaylistTracks: async () =>
        p === "spotify"
          ? [
              {
                provider: "spotify" as const,
                id: "t1",
                title: "Song",
                artists: ["X"],
                isrc: "USABC1234567",
              },
            ]
          : [],
      addTracksToPlaylist: addSpy,
      findTrackByIsrc: async () => ({
        provider: p,
        id: `${p}_t1`,
        title: "Song",
        artists: ["X"],
        isrc: "USABC1234567",
      }),
      searchTracks: async () => [],
      createPlaylist: async (_a: string, name: string) => ({ playlistId: "new_pl", name }),
    }) as never);

    const result = await syncPair(share.id);
    expect(result.active).toBe(true);
    // Alice's source list contains 1 track; fan-out targets Bob + Carol = 2 writes.
    expect(addSpy).toHaveBeenCalledTimes(2);
  });
});
