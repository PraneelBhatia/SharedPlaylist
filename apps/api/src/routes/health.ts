import type { FastifyInstance } from "fastify";
import { prisma } from "../db/prisma.ts";

export async function registerHealthRoutes(app: FastifyInstance): Promise<void> {
  app.get("/v1/health", async () => {
    await prisma.$queryRaw`SELECT 1`;
    return { ok: true };
  });
}
