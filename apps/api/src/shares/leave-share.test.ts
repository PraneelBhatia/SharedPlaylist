import { beforeEach, describe, expect, it } from "vitest";
import { prisma } from "../db/prisma.ts";
import { leaveShare } from "./leave-share.ts";

async function cleanup() {
  await prisma.shareInviteView.deleteMany();
  await prisma.playlistLink.deleteMany();
  await prisma.pairMember.deleteMany();
  await prisma.pair.deleteMany();
  await prisma.user.deleteMany();
}

describe("leaveShare", () => {
  beforeEach(cleanup);

  async function seed3PersonShare() {
    const alice = await prisma.user.create({ data: { email: "a@x.com", displayName: "A" } });
    const bob = await prisma.user.create({ data: { email: "b@x.com", displayName: "B" } });
    const carol = await prisma.user.create({ data: { email: "c@x.com", displayName: "C" } });
    const share = await prisma.pair.create({
      data: {
        status: "active",
        creatorId: alice.id,
        sourceProvider: "spotify",
        sourcePlaylistId: "pl1",
        sourcePlaylistName: "Mix",
        members: { create: [{ userId: alice.id }, { userId: bob.id }, { userId: carol.id }] },
        playlists: {
          create: [
            { userId: alice.id, provider: "spotify", playlistId: "pl1" },
            { userId: bob.id, provider: "apple_music", playlistId: "pl_b" },
            { userId: carol.id, provider: "youtube", playlistId: "pl_c" },
          ],
        },
      },
    });
    return { alice, bob, carol, share };
  }

  it("removes the leaver's member row and PlaylistLink; share continues", async () => {
    const { bob, share } = await seed3PersonShare();
    const result = await leaveShare(share.id, bob.id);
    expect(result.status).toBe("active");
    const members = await prisma.pairMember.findMany({ where: { pairId: share.id } });
    expect(members.length).toBe(2);
    const bobsLink = await prisma.playlistLink.findFirst({ where: { pairId: share.id, userId: bob.id } });
    expect(bobsLink).toBeNull();
  });

  it("marks share as ended when the last member leaves", async () => {
    const alice = await prisma.user.create({ data: { email: "a@x.com", displayName: "A" } });
    const share = await prisma.pair.create({
      data: {
        status: "pending",
        creatorId: alice.id,
        sourceProvider: "spotify",
        sourcePlaylistId: "pl",
        sourcePlaylistName: "M",
        members: { create: [{ userId: alice.id }] },
      },
    });
    const result = await leaveShare(share.id, alice.id);
    expect(result.status).toBe("ended");
    expect(result.endedById).toBe(alice.id);
    expect(result.endedAt).not.toBeNull();
  });

  it("throws 403 if user is not a member", async () => {
    const { share } = await seed3PersonShare();
    const stranger = await prisma.user.create({ data: { email: "s@x.com", displayName: "S" } });
    await expect(leaveShare(share.id, stranger.id)).rejects.toMatchObject({ statusCode: 403 });
  });
});
