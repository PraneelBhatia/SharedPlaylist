import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { prisma } from "../db/prisma.ts";
import { acceptShare } from "./accept-share.ts";

async function seed() {
  const alice = await prisma.user.create({ data: { email: "alice@example.com", displayName: "Alice" } });
  const share = await prisma.pair.create({
    data: {
      status: "pending",
      creatorId: alice.id,
      sourceProvider: "spotify",
      sourcePlaylistId: "pl1",
      sourcePlaylistName: "Road Trip Mix",
      inviteToken: "tok",
      inviteExpires: new Date(Date.now() + 24 * 60 * 60 * 1000),
      members: { create: [{ userId: alice.id }] },
    },
  });
  return { alice, share };
}

async function cleanup() {
  await prisma.shareInviteView.deleteMany();
  await prisma.playlistLink.deleteMany();
  await prisma.pairMember.deleteMany();
  await prisma.pair.deleteMany();
  await prisma.user.deleteMany();
}

describe("acceptShare", () => {
  beforeEach(cleanup);
  afterEach(async () => prisma.$disconnect());

  it("adds the joiner as a member and flips pending → active", async () => {
    const { alice, share } = await seed();
    const bob = await prisma.user.create({ data: { email: "bob@example.com", displayName: "Bob" } });
    const result = await acceptShare({
      token: "tok",
      userId: bob.id,
      destinationProvider: "apple_music",
      memberCap: 5,
      autoCreatePlaylist: async () => ({ playlistId: "apple_pl_xyz", name: "Road Trip Mix" }),
    });
    expect(result.status).toBe("active");
    const members = await prisma.pairMember.findMany({ where: { pairId: share.id } });
    expect(members.map((m) => m.userId).sort()).toEqual([alice.id, bob.id].sort());
    const links = await prisma.playlistLink.findMany({ where: { pairId: share.id } });
    expect(links.find((l) => l.userId === bob.id)?.playlistId).toBe("apple_pl_xyz");
  });

  it("is idempotent when the same user accepts twice", async () => {
    const { share } = await seed();
    const bob = await prisma.user.create({ data: { email: "bob@example.com", displayName: "Bob" } });
    const first = await acceptShare({
      token: "tok",
      userId: bob.id,
      destinationProvider: "apple_music",
      memberCap: 5,
      autoCreatePlaylist: async () => ({ playlistId: "apple_pl_xyz", name: "Road Trip Mix" }),
    });
    const second = await acceptShare({
      token: "tok",
      userId: bob.id,
      destinationProvider: "apple_music",
      memberCap: 5,
      autoCreatePlaylist: async () => ({ playlistId: "should_not_be_called", name: "x" }),
    });
    expect(second.id).toBe(first.id);
    const members = await prisma.pairMember.findMany({ where: { pairId: share.id } });
    expect(members.length).toBe(2);
  });

  it("returns 409 when the cap is reached", async () => {
    const { share } = await seed();
    for (let i = 0; i < 4; i++) {
      const u = await prisma.user.create({ data: { email: `u${i}@x.com`, displayName: `U${i}` } });
      await prisma.pairMember.create({ data: { pairId: share.id, userId: u.id } });
    }
    const lateJoiner = await prisma.user.create({ data: { email: "late@example.com", displayName: "Late" } });
    await expect(
      acceptShare({
        token: "tok",
        userId: lateJoiner.id,
        destinationProvider: "youtube",
        memberCap: 5,
        autoCreatePlaylist: async () => ({ playlistId: "yt_pl", name: "x" }),
      }),
    ).rejects.toMatchObject({ statusCode: 409 });
  });
});
