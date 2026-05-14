import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { Prisma } from "@prisma/client";
import { isProvider } from "@sharedplaylist/shared-types";
import { prisma } from "../db/prisma.ts";
import { config } from "../config.ts";
import { getCurrentUser } from "./context.ts";
import { mintInviteToken } from "../shares/invite-token.ts";
import { hashIp } from "../shares/ip-hash.ts";
import { acceptShare } from "../shares/accept-share.ts";
import { leaveShare } from "../shares/leave-share.ts";
import { createDestinationPlaylistFor } from "../shares/create-destination-playlist.ts";
import { enqueueSync } from "../queues/sync-queue.ts";
import type { Provider } from "@sharedplaylist/shared-types";

const createShareBody = z.object({
  sourceProvider: z.string().refine(isProvider),
  sourcePlaylistId: z.string().min(1),
  sourcePlaylistName: z.string().min(1),
});

const acceptShareBody = z.object({
  destinationProvider: z.string().refine(isProvider),
});

async function loadShareForUser(userId: string, shareId: string) {
  const share = await prisma.pair.findUnique({
    where: { id: shareId },
    include: {
      members: { include: { user: true } },
      playlists: true,
    },
  });
  if (!share) {
    const err = new Error("Share not found") as Error & { statusCode?: number };
    err.statusCode = 404;
    throw err;
  }
  const isMember = share.members.some((m) => m.userId === userId);
  if (!isMember) {
    const err = new Error("Not a member of this share") as Error & { statusCode?: number };
    err.statusCode = 403;
    throw err;
  }
  return share;
}

function toShareDto(
  share: Awaited<ReturnType<typeof loadShareForUser>>,
  lastSyncedAt: Date | null,
) {
  return {
    id: share.id,
    status: share.status,
    sourceProvider: share.sourceProvider,
    sourcePlaylistId: share.sourcePlaylistId,
    sourcePlaylistName: share.sourcePlaylistName,
    creatorId: share.creatorId,
    memberCount: share.members.length,
    memberCap: config.MAX_SHARE_MEMBERS,
    members: share.members.map((m) => ({
      userId: m.userId,
      displayName: m.user.displayName,
      provider: share.playlists.find((p) => p.userId === m.userId)?.provider ?? share.sourceProvider,
      isCreator: m.userId === share.creatorId,
      joinedAt: m.createdAt.toISOString(),
      needsReauth: false,
    })),
    playlists: share.playlists.map((p) => ({
      userId: p.userId,
      provider: p.provider,
      playlistId: p.playlistId,
      name: p.name,
    })),
    inviteToken: share.inviteToken,
    inviteExpires: share.inviteExpires?.toISOString() ?? null,
    lastSyncedAt: lastSyncedAt?.toISOString() ?? null,
    createdAt: share.createdAt.toISOString(),
    endedAt: share.endedAt?.toISOString() ?? null,
    endedById: share.endedById,
  };
}

async function loadShareAsCreator(userId: string, shareId: string) {
  const share = await prisma.pair.findUnique({ where: { id: shareId }, include: { members: true } });
  if (!share) {
    const err = new Error("Share not found") as Error & { statusCode?: number };
    err.statusCode = 404;
    throw err;
  }
  if (share.creatorId !== userId) {
    const err = new Error("Only the share creator can manage the invite link.") as Error & { statusCode?: number };
    err.statusCode = 403;
    throw err;
  }
  const stillMember = share.members.some((m) => m.userId === userId);
  if (!stillMember) {
    const err = new Error("Original creator has left the share; the link is permanently closed.") as Error & { statusCode?: number };
    err.statusCode = 403;
    throw err;
  }
  return share;
}

async function getLastSyncedAt(shareId: string): Promise<Date | null> {
  const row = await prisma.syncEvent.findFirst({
    where: { pairId: shareId, kind: "written" },
    orderBy: { createdAt: "desc" },
    select: { createdAt: true },
  });
  return row?.createdAt ?? null;
}

export async function registerShareRoutes(app: FastifyInstance): Promise<void> {
  app.get("/v1/shares/_health", async () => ({ ok: true }));

  app.post("/v1/shares", async (req, reply) => {
    const user = await getCurrentUser(req);
    const body = createShareBody.parse(req.body);
    const { token, expiresAt } = mintInviteToken(config.INVITE_TTL_DAYS);

    try {
      const share = await prisma.pair.create({
        data: {
          status: "pending",
          creatorId: user.id,
          sourceProvider: body.sourceProvider,
          sourcePlaylistId: body.sourcePlaylistId,
          sourcePlaylistName: body.sourcePlaylistName,
          inviteToken: token,
          inviteExpires: expiresAt,
          members: { create: [{ userId: user.id }] },
        },
        include: { members: true, playlists: true },
      });

      reply.code(201);
      return {
        share: {
          id: share.id,
          status: share.status,
          sourceProvider: share.sourceProvider,
          sourcePlaylistId: share.sourcePlaylistId,
          sourcePlaylistName: share.sourcePlaylistName,
          creatorId: share.creatorId,
          memberCount: share.members.length,
          memberCap: config.MAX_SHARE_MEMBERS,
          createdAt: share.createdAt.toISOString(),
        },
        inviteToken: token,
        inviteExpires: expiresAt.toISOString(),
      };
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
        const conflict = new Error("You already have an active share for this playlist.") as Error & { statusCode?: number };
        conflict.statusCode = 409;
        throw conflict;
      }
      throw err;
    }
  });

  app.get("/v1/shares", async (req) => {
    const user = await getCurrentUser(req);
    const memberships = await prisma.pairMember.findMany({
      where: { userId: user.id },
      include: { pair: { include: { members: { include: { user: true } }, playlists: true } } },
      orderBy: { pair: { createdAt: "desc" } },
    });
    const shares = await Promise.all(
      memberships.map(async (m) => toShareDto(m.pair, await getLastSyncedAt(m.pair.id))),
    );
    return { shares };
  });

  app.get("/v1/shares/:id", async (req) => {
    const user = await getCurrentUser(req);
    const params = z.object({ id: z.string() }).parse(req.params);
    const share = await loadShareForUser(user.id, params.id);
    const lastSyncedAt = await getLastSyncedAt(share.id);
    return { share: toShareDto(share, lastSyncedAt) };
  });

  app.post("/v1/shares/accept/:token", async (req) => {
    const user = await getCurrentUser(req);
    const params = z.object({ token: z.string() }).parse(req.params);
    const body = acceptShareBody.parse(req.body);

    const createDestinationPlaylist = async (name: string, provider: Provider) =>
      createDestinationPlaylistFor(user.id, name, provider);

    const share = await acceptShare({
      token: params.token,
      userId: user.id,
      destinationProvider: body.destinationProvider as Provider,
      memberCap: config.MAX_SHARE_MEMBERS,
      autoCreatePlaylist: createDestinationPlaylist,
    });

    const fullShare = await loadShareForUser(user.id, share.id);
    const lastSyncedAt = await getLastSyncedAt(share.id);
    return { share: toShareDto(fullShare, lastSyncedAt) };
  });

  app.get("/v1/shares/preview/:token", async (req, reply) => {
    const params = z.object({ token: z.string().min(1) }).parse(req.params);
    const share = await prisma.pair.findUnique({
      where: { inviteToken: params.token },
      include: { creator: true, members: true },
    });

    const isExpired =
      !share || !share.inviteExpires || share.inviteExpires <= new Date() || share.status === "ended";

    if (isExpired || !share) {
      reply.code(410);
      return { reason: "invalid_or_expired" };
    }

    if (share.members.length >= config.MAX_SHARE_MEMBERS) {
      reply.code(409);
      return { reason: "full" };
    }

    const userAgent = req.headers["user-agent"] ?? null;
    const ipHash = hashIp(req.ip, config.IP_HASH_SALT, new Date());
    await prisma.shareInviteView.create({
      data: { pairId: share.id, userAgent, ipHash },
    });

    return {
      sourcePlaylistName: share.sourcePlaylistName,
      sourceProvider: share.sourceProvider,
      creatorDisplayName: share.creator.displayName,
      memberCount: share.members.length,
      memberCap: config.MAX_SHARE_MEMBERS,
    };
  });

  app.post("/v1/shares/:id/pause", async (req) => {
    const user = await getCurrentUser(req);
    const params = z.object({ id: z.string() }).parse(req.params);
    await loadShareForUser(user.id, params.id);
    await prisma.pair.update({ where: { id: params.id }, data: { status: "paused" } });
    const share = await loadShareForUser(user.id, params.id);
    return { share: toShareDto(share, await getLastSyncedAt(share.id)) };
  });

  app.post("/v1/shares/:id/resume", async (req) => {
    const user = await getCurrentUser(req);
    const params = z.object({ id: z.string() }).parse(req.params);
    await loadShareForUser(user.id, params.id);
    await prisma.pair.update({ where: { id: params.id }, data: { status: "active" } });
    const share = await loadShareForUser(user.id, params.id);
    return { share: toShareDto(share, await getLastSyncedAt(share.id)) };
  });

  app.post("/v1/shares/:id/regenerate-invite", async (req) => {
    const user = await getCurrentUser(req);
    const params = z.object({ id: z.string() }).parse(req.params);
    await loadShareAsCreator(user.id, params.id);
    const { token, expiresAt } = mintInviteToken(config.INVITE_TTL_DAYS);
    await prisma.pair.update({
      where: { id: params.id },
      data: { inviteToken: token, inviteExpires: expiresAt },
    });
    return { inviteToken: token, inviteExpires: expiresAt.toISOString() };
  });

  app.delete("/v1/shares/:id/invite", async (req) => {
    const user = await getCurrentUser(req);
    const params = z.object({ id: z.string() }).parse(req.params);
    await loadShareAsCreator(user.id, params.id);
    await prisma.pair.update({
      where: { id: params.id },
      data: { inviteToken: null, inviteExpires: null },
    });
    return { ok: true };
  });

  app.post("/v1/shares/:id/leave", async (req) => {
    const user = await getCurrentUser(req);
    const params = z.object({ id: z.string() }).parse(req.params);
    const share = await leaveShare(params.id, user.id);
    if (share.status === "ended") {
      return { share: { id: share.id, status: share.status, endedAt: share.endedAt?.toISOString() } };
    }
    const fullShare = await loadShareForUser(user.id, share.id).catch(() => null);
    return fullShare ? { share: toShareDto(fullShare, null) } : { share: { id: share.id, status: share.status } };
  });

  app.post("/v1/shares/:id/sync-now", async (req) => {
    const user = await getCurrentUser(req);
    const params = z.object({ id: z.string() }).parse(req.params);
    await loadShareForUser(user.id, params.id);
    await enqueueSync(params.id);
    return { ok: true };
  });

  app.get("/v1/shares/:id/events", async (req) => {
    const user = await getCurrentUser(req);
    const params = z.object({ id: z.string() }).parse(req.params);
    await loadShareForUser(user.id, params.id);
    const events = await prisma.syncEvent.findMany({
      where: { pairId: params.id },
      orderBy: { createdAt: "desc" },
      take: 50,
    });
    const lastSyncedAt = await getLastSyncedAt(params.id);
    return { events, lastSyncedAt: lastSyncedAt?.toISOString() ?? null };
  });
}
