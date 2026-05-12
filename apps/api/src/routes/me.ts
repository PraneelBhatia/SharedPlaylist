import type { FastifyInstance } from "fastify";
import { getCurrentUser } from "./context.ts";

export async function registerMeRoutes(app: FastifyInstance): Promise<void> {
  app.get("/v1/me", async (req) => {
    const user = await getCurrentUser(req);
    return { user };
  });
}
