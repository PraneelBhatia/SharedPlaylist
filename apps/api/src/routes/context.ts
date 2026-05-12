import type { FastifyRequest } from "fastify";
import { prisma } from "../db/prisma.ts";

export async function getCurrentUser(req: FastifyRequest): Promise<{ id: string; email: string | null }> {
  const headerUserId = req.headers["x-user-id"];
  if (typeof headerUserId === "string" && headerUserId.length > 0) {
    const user = await prisma.user.findUnique({ where: { id: headerUserId } });
    if (user) return { id: user.id, email: user.email };
  }

  const user = await prisma.user.upsert({
    where: { email: "dev@sharedplaylist.local" },
    update: {},
    create: {
      email: "dev@sharedplaylist.local",
      displayName: "Local Dev User",
    },
  });
  return { id: user.id, email: user.email };
}
