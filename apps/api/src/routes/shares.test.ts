import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { buildServer } from "../server.ts";
import { prisma } from "../db/prisma.ts";

const TEST_USER_HEADER = "x-user-id";

async function makeUser(email: string) {
  return prisma.user.upsert({
    where: { email },
    update: {},
    create: { email, displayName: email.split("@")[0]! },
  });
}

async function cleanup() {
  await prisma.shareInviteView.deleteMany();
  await prisma.playlistLink.deleteMany();
  await prisma.pairMember.deleteMany();
  await prisma.pair.deleteMany();
  await prisma.user.deleteMany();
}

describe("POST /v1/shares", () => {
  beforeEach(cleanup);
  afterEach(async () => prisma.$disconnect());

  it("creates a pending share with an invite token", async () => {
    const alice = await makeUser("alice@example.com");
    const app = buildServer();
    const res = await app.inject({
      method: "POST",
      url: "/v1/shares",
      headers: { [TEST_USER_HEADER]: alice.id },
      payload: {
        sourceProvider: "spotify",
        sourcePlaylistId: "spotify_pl_abc",
        sourcePlaylistName: "Road Trip Mix",
      },
    });
    expect(res.statusCode).toBe(201);
    const body = res.json();
    expect(body.share.status).toBe("pending");
    expect(body.share.creatorId).toBe(alice.id);
    expect(body.share.sourcePlaylistName).toBe("Road Trip Mix");
    expect(body.share.memberCap).toBe(5);
    expect(body.share.memberCount).toBe(1);
    expect(body.inviteToken).toMatch(/^[A-Za-z0-9_-]+$/);
    expect(new Date(body.inviteExpires).getTime()).toBeGreaterThan(Date.now());
  });

  it("returns 409 if the user already has an active share for the same playlist", async () => {
    const alice = await makeUser("alice@example.com");
    const app = buildServer();
    await app.inject({
      method: "POST", url: "/v1/shares",
      headers: { [TEST_USER_HEADER]: alice.id },
      payload: { sourceProvider: "spotify", sourcePlaylistId: "spotify_pl_abc", sourcePlaylistName: "Road Trip Mix" },
    });
    const conflict = await app.inject({
      method: "POST", url: "/v1/shares",
      headers: { [TEST_USER_HEADER]: alice.id },
      payload: { sourceProvider: "spotify", sourcePlaylistId: "spotify_pl_abc", sourcePlaylistName: "Road Trip Mix" },
    });
    expect(conflict.statusCode).toBe(409);
  });
});
