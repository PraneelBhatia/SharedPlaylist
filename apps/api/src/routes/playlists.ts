import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { isProvider } from "@sharedplaylist/shared-types";
import { getProviderClient } from "../providers/index.ts";
import { getCurrentUser } from "./context.ts";
import { getConnectionTokens } from "../sync/tokens.ts";

const providerParam = z.object({ provider: z.string().refine(isProvider) });

export async function registerPlaylistRoutes(app: FastifyInstance): Promise<void> {
  app.get("/v1/playlists/:provider", async (req) => {
    const user = await getCurrentUser(req);
    const { provider } = providerParam.parse(req.params);
    const tokens = await getConnectionTokens(user.id, provider);
    const playlists = await getProviderClient(provider).listPlaylists(
      tokens.accessToken,
      tokens.userToken,
    );
    return { playlists };
  });
}
