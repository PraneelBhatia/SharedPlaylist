import { beforeEach, describe, expect, it } from "vitest";
import { prisma } from "../db/prisma.ts";
import { computeAdminStats } from "./stats-queries.ts";

async function cleanup() {
  await prisma.shareInviteView.deleteMany();
  await prisma.syncEvent.deleteMany();
  await prisma.unmatchedTrack.deleteMany();
  await prisma.trackMapping.deleteMany();
  await prisma.playlistLink.deleteMany();
  await prisma.pairMember.deleteMany();
  await prisma.serviceConnection.deleteMany();
  await prisma.pair.deleteMany();
  await prisma.user.deleteMany();
}

describe("computeAdminStats", () => {
  beforeEach(cleanup);

  it("counts users, shares-by-status, and providers", async () => {
    const alice = await prisma.user.create({ data: { email: "a@x.com", displayName: "A" } });
    await prisma.user.create({ data: { email: "b@x.com", displayName: "B" } });
    await prisma.serviceConnection.create({
      data: { userId: alice.id, provider: "spotify", scopes: [] },
    });
    await prisma.pair.create({
      data: {
        status: "active", creatorId: alice.id,
        sourceProvider: "spotify", sourcePlaylistId: "p", sourcePlaylistName: "n",
        members: { create: [{ userId: alice.id }] },
      },
    });

    const stats = await computeAdminStats();
    expect(stats.users.total).toBe(2);
    expect(stats.shares.byStatus.active).toBe(1);
    expect(stats.providers.spotify).toBe(1);
  });
});
