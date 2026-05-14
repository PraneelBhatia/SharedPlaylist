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

describe("GET /v1/shares and GET /v1/shares/:id", () => {
  beforeEach(cleanup);

  it("GET /v1/shares lists the user's shares with members", async () => {
    const alice = await makeUser("alice@example.com");
    const app = buildServer();

    const created = await app.inject({
      method: "POST", url: "/v1/shares",
      headers: { [TEST_USER_HEADER]: alice.id },
      payload: { sourceProvider: "spotify", sourcePlaylistId: "spotify_pl_abc", sourcePlaylistName: "Road Trip Mix" },
    });
    const createdId = created.json().share.id;

    const list = await app.inject({
      method: "GET", url: "/v1/shares",
      headers: { [TEST_USER_HEADER]: alice.id },
    });

    expect(list.statusCode).toBe(200);
    const shares = list.json().shares;
    expect(shares).toHaveLength(1);
    expect(shares[0].id).toBe(createdId);
    expect(shares[0].members).toHaveLength(1);
    expect(shares[0].members[0].userId).toBe(alice.id);
    expect(shares[0].members[0].isCreator).toBe(true);
  });

  it("GET /v1/shares/:id returns 403 for non-members", async () => {
    const alice = await makeUser("alice@example.com");
    const bob = await makeUser("bob@example.com");
    const app = buildServer();
    const created = await app.inject({
      method: "POST", url: "/v1/shares",
      headers: { [TEST_USER_HEADER]: alice.id },
      payload: { sourceProvider: "spotify", sourcePlaylistId: "spotify_pl_abc", sourcePlaylistName: "Road Trip Mix" },
    });
    const createdId = created.json().share.id;
    const res = await app.inject({
      method: "GET",
      url: `/v1/shares/${createdId}`,
      headers: { [TEST_USER_HEADER]: bob.id },
    });
    expect(res.statusCode).toBe(403);
  });
});

describe("GET /v1/shares/preview/:token", () => {
  beforeEach(cleanup);

  it("returns preview metadata for a valid token + logs a view", async () => {
    const alice = await makeUser("alice@example.com");
    const app = buildServer();
    const created = await app.inject({
      method: "POST", url: "/v1/shares",
      headers: { [TEST_USER_HEADER]: alice.id },
      payload: { sourceProvider: "spotify", sourcePlaylistId: "pl1", sourcePlaylistName: "Road Trip Mix" },
    });
    const token = created.json().inviteToken;

    const res = await app.inject({ method: "GET", url: `/v1/shares/preview/${token}` });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.sourcePlaylistName).toBe("Road Trip Mix");
    expect(body.sourceProvider).toBe("spotify");
    expect(body.memberCount).toBe(1);
    expect(body.memberCap).toBe(5);
    const views = await prisma.shareInviteView.count();
    expect(views).toBe(1);
  });

  it("returns 410 for an unknown token without leaking info", async () => {
    const app = buildServer();
    const res = await app.inject({ method: "GET", url: "/v1/shares/preview/does-not-exist" });
    expect(res.statusCode).toBe(410);
    expect(res.json().sourcePlaylistName).toBeUndefined();
  });
});

describe("POST /v1/shares/accept/:token", () => {
  beforeEach(cleanup);

  it("Bob joins Alice's share; status flips active", async () => {
    const alice = await makeUser("alice@example.com");
    const bob = await makeUser("bob@example.com");
    const app = buildServer();
    const created = await app.inject({
      method: "POST", url: "/v1/shares",
      headers: { [TEST_USER_HEADER]: alice.id },
      payload: { sourceProvider: "spotify", sourcePlaylistId: "pl1", sourcePlaylistName: "Road Trip Mix" },
    });
    const token = created.json().inviteToken;
    const accepted = await app.inject({
      method: "POST",
      url: `/v1/shares/accept/${token}`,
      headers: { [TEST_USER_HEADER]: bob.id },
      payload: { destinationProvider: "apple_music" },
    });
    expect(accepted.statusCode).toBe(200);
    expect(accepted.json().share.status).toBe("active");
    expect(accepted.json().share.memberCount).toBe(2);
  });
});
