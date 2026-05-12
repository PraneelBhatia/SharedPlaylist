import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { isProvider } from "@sharedplaylist/shared-types";
import { prisma } from "../db/prisma.ts";
import { enqueueSync } from "../queues/sync-queue.ts";
import { getCurrentUser } from "./context.ts";

const playlistBody = z.object({
  playlists: z
    .array(
      z.object({
        provider: z.string().refine(isProvider),
        playlistId: z.string().min(1),
        name: z.string().optional(),
        canEdit: z.boolean().default(true),
      }),
    )
    .min(2),
});

export async function registerPairRoutes(app: FastifyInstance): Promise<void> {
  app.post("/v1/pairs", async (req) => {
    const user = await getCurrentUser(req);
    const pair = await prisma.pair.create({
      data: {
        status: "pending",
        members: { create: [{ userId: user.id }] },
      },
    });
    return { pair };
  });

  app.post("/v1/pairs/:id/invite", async (req) => {
    const params = z.object({ id: z.string() }).parse(req.params);
    const token = crypto.randomUUID();
    const pair = await prisma.pair.update({
      where: { id: params.id },
      data: {
        inviteToken: token,
        inviteExpires: new Date(Date.now() + 24 * 60 * 60 * 1000),
      },
    });
    return { inviteToken: pair.inviteToken, inviteExpires: pair.inviteExpires };
  });

  app.post("/v1/pairs/join", async (req) => {
    const user = await getCurrentUser(req);
    const body = z.object({ inviteToken: z.string() }).parse(req.body);
    const pair = await prisma.pair.findUnique({ where: { inviteToken: body.inviteToken } });
    if (!pair || !pair.inviteExpires || pair.inviteExpires <= new Date()) {
      throw new Error("Invite is invalid or expired");
    }
    await prisma.pairMember.upsert({
      where: { pairId_userId: { pairId: pair.id, userId: user.id } },
      update: {},
      create: { pairId: pair.id, userId: user.id },
    });
    const updated = await prisma.pair.update({
      where: { id: pair.id },
      data: { status: "active", inviteToken: null, inviteExpires: null },
    });
    await enqueueSync(updated.id);
    return { pair: updated };
  });

  app.post("/v1/pairs/:id/playlists", async (req) => {
    const params = z.object({ id: z.string() }).parse(req.params);
    const body = playlistBody.parse(req.body);
    await prisma.$transaction(
      body.playlists.map((playlist) =>
        prisma.playlistLink.upsert({
          where: { pairId_provider: { pairId: params.id, provider: playlist.provider } },
          update: {
            playlistId: playlist.playlistId,
            name: playlist.name,
            canEdit: playlist.canEdit,
            cursor: null,
          },
          create: {
            pairId: params.id,
            provider: playlist.provider,
            playlistId: playlist.playlistId,
            name: playlist.name,
            canEdit: playlist.canEdit,
          },
        }),
      ),
    );
    await enqueueSync(params.id);
    return { ok: true };
  });

  app.post("/v1/pairs/:id/sync-now", async (req) => {
    const params = z.object({ id: z.string() }).parse(req.params);
    await enqueueSync(params.id);
    return { ok: true };
  });

  app.get("/v1/pairs/:id/events", async (req) => {
    const params = z.object({ id: z.string() }).parse(req.params);
    const events = await prisma.syncEvent.findMany({
      where: { pairId: params.id },
      orderBy: { createdAt: "desc" },
      take: 50,
    });
    return { events };
  });
}
