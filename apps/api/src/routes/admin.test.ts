import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { buildServer } from "../server.ts";
import { prisma } from "../db/prisma.ts";

async function cleanup() {
  await prisma.shareInviteView.deleteMany();
  await prisma.playlistLink.deleteMany();
  await prisma.pairMember.deleteMany();
  await prisma.pair.deleteMany();
  await prisma.user.deleteMany();
}

describe("GET /v1/admin/stats", () => {
  beforeEach(async () => {
    await cleanup();
    vi.unstubAllEnvs();
  });
  afterEach(() => vi.unstubAllEnvs());

  it("returns 404 to non-owner email", async () => {
    vi.stubEnv("ADMIN_OWNER_EMAIL", "owner@example.com");
    const stranger = await prisma.user.create({ data: { email: "rando@x.com", displayName: "R" } });
    const app = buildServer();
    const res = await app.inject({
      method: "GET",
      url: "/v1/admin/stats",
      headers: { "x-user-id": stranger.id },
    });
    expect(res.statusCode).toBe(404);
  });

  it("returns 200 with stats to the configured owner", async () => {
    vi.stubEnv("ADMIN_OWNER_EMAIL", "owner@example.com");
    const owner = await prisma.user.create({ data: { email: "owner@example.com", displayName: "O" } });
    const app = buildServer();
    const res = await app.inject({
      method: "GET",
      url: "/v1/admin/stats",
      headers: { "x-user-id": owner.id },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().users.total).toBeGreaterThanOrEqual(1);
  });

  it("returns 404 to everyone when ADMIN_OWNER_EMAIL is empty", async () => {
    vi.stubEnv("ADMIN_OWNER_EMAIL", "");
    const owner = await prisma.user.create({ data: { email: "owner@example.com", displayName: "O" } });
    const app = buildServer();
    const res = await app.inject({
      method: "GET",
      url: "/v1/admin/stats",
      headers: { "x-user-id": owner.id },
    });
    expect(res.statusCode).toBe(404);
  });
});
