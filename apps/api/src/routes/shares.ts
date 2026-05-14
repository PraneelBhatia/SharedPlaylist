import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { Prisma } from "@prisma/client";
import { isProvider } from "@sharedplaylist/shared-types";
import { prisma } from "../db/prisma.ts";
import { config } from "../config.ts";
import { getCurrentUser } from "./context.ts";
import { mintInviteToken } from "../shares/invite-token.ts";

const createShareBody = z.object({
  sourceProvider: z.string().refine(isProvider),
  sourcePlaylistId: z.string().min(1),
  sourcePlaylistName: z.string().min(1),
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
}
