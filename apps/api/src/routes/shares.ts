import type { FastifyInstance } from "fastify";

export async function registerShareRoutes(app: FastifyInstance): Promise<void> {
  app.get("/v1/shares/_health", async () => ({ ok: true }));
}
