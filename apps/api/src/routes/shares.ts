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
}
