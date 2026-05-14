import Fastify from "fastify";
import { config } from "./config.ts";
import { registerConnectionRoutes } from "./routes/connections.ts";
import { registerHealthRoutes } from "./routes/health.ts";
import { registerMeRoutes } from "./routes/me.ts";
import { registerPlaylistRoutes } from "./routes/playlists.ts";
import { registerShareRoutes } from "./routes/shares.ts";

export function buildServer() {
  const app = Fastify({ logger: true });

  app.setErrorHandler((err: Error & { statusCode?: number }, _req, reply) => {
    const statusCode = err.statusCode ?? 500;
    reply.status(statusCode).send({
      error: statusCode >= 500 ? "internal_server_error" : "bad_request",
      message: err.message,
    });
  });

  app.register(registerHealthRoutes);
  app.register(registerMeRoutes);
  app.register(registerConnectionRoutes);
  app.register(registerPlaylistRoutes);
  app.register(registerShareRoutes);

  return app;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const app = buildServer();
  await app.listen({ host: config.API_HOST, port: config.API_PORT });
}
