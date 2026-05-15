import { beforeEach, describe, expect, it } from "vitest";
import { prisma } from "../db/prisma.ts";
import { recoverShare } from "./recover-share.ts";

async function cleanup() {
  await prisma.shareInviteView.deleteMany();
  await prisma.playlistLink.deleteMany();
  await prisma.pairMember.deleteMany();
  await prisma.pair.deleteMany();
  await prisma.user.deleteMany();
}

async function seedNeedsReauth() {
  const alice = await prisma.user.create({ data: { email: "a@x.com", displayName: "A" } });
  const bob = await prisma.user.create({ data: { email: "b@x.com", displayName: "B" } });
  const share = await prisma.pair.create({
    data: {
      status: "needs_reauth",
      creatorId: alice.id,
      sourceProvider: "spotify",
      sourcePlaylistId: "pl1",
      sourcePlaylistName: "Quiet Mornings",
      members: { create: [{ userId: alice.id }, { userId: bob.id }] },
      playlists: {
        create: [
          { userId: alice.id, provider: "spotify", playlistId: "pl1" },
          { userId: bob.id, provider: "apple_music", playlistId: "old_apple_pl" },
        ],
      },
    },
    include: { playlists: true },
  });
  return { alice, bob, share };
}

describe("recoverShare", () => {
  beforeEach(cleanup);

  it("action='create' replaces the user's PlaylistLink and flips status to active", async () => {
    const { bob, share } = await seedNeedsReauth();
    const result = await recoverShare({
      shareId: share.id,
      userId: bob.id,
      action: "create",
      autoCreatePlaylist: async () => ({ playlistId: "new_apple_pl", name: "Quiet Mornings" }),
    });
    expect(result.status).toBe("active");
    const bobLink = await prisma.playlistLink.findFirstOrThrow({ where: { pairId: share.id, userId: bob.id } });
    expect(bobLink.playlistId).toBe("new_apple_pl");
  });

  it("action='select' uses provided playlistId", async () => {
    const { bob, share } = await seedNeedsReauth();
    const result = await recoverShare({
      shareId: share.id,
      userId: bob.id,
      action: "select",
      playlistId: "existing_apple_pl",
    });
    expect(result.status).toBe("active");
    const bobLink = await prisma.playlistLink.findFirstOrThrow({ where: { pairId: share.id, userId: bob.id } });
    expect(bobLink.playlistId).toBe("existing_apple_pl");
  });

  it("rejects with 400 when action='select' but no playlistId", async () => {
    const { bob, share } = await seedNeedsReauth();
    await expect(
      recoverShare({ shareId: share.id, userId: bob.id, action: "select" }),
    ).rejects.toMatchObject({ statusCode: 400 });
  });
});
