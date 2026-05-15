import type { FastifyInstance } from "fastify";
import { computeAdminStats } from "../admin/stats-queries.ts";
import { getCurrentUser } from "./context.ts";

export async function registerAdminRoutes(app: FastifyInstance): Promise<void> {
  app.get("/v1/admin/stats", async (req, reply) => {
    const ownerEmail = process.env.ADMIN_OWNER_EMAIL ?? "";
    const user = await getCurrentUser(req);
    if (!ownerEmail || user.email !== ownerEmail) {
      reply.code(404);
      return { error: "not_found" };
    }
    return computeAdminStats();
  });
}
