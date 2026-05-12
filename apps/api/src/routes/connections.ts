import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { isProvider } from "@sharedplaylist/shared-types";
import { prisma } from "../db/prisma.ts";
import { redis } from "../db/redis.ts";
import { encryptToken } from "../crypto/token-vault.ts";
import { getProviderClient } from "../providers/index.ts";
import { config } from "../config.ts";
import { getCurrentUser } from "./context.ts";

const providerParam = z.object({ provider: z.string().refine(isProvider) });
const callbackBody = z.object({
  code: z.string().optional(),
  state: z.string().optional(),
  musicUserToken: z.string().optional(),
});

export async function registerConnectionRoutes(app: FastifyInstance): Promise<void> {
  app.get("/v1/connections", async (req) => {
    const user = await getCurrentUser(req);
    const connections = await prisma.serviceConnection.findMany({
      where: { userId: user.id },
      select: { provider: true, tokenExpiresAt: true, encryptedUserToken: true },
    });
    return {
      connections: connections.map((connection) => ({
        provider: connection.provider,
        connected: true,
        expiresAt: connection.tokenExpiresAt?.toISOString(),
        needsReauth: connection.tokenExpiresAt ? connection.tokenExpiresAt <= new Date() : false,
      })),
      youtubeBetaEnabled: config.YOUTUBE_BETA_ENABLED,
    };
  });

  app.post("/v1/connections/:provider/start", async (req) => {
    const user = await getCurrentUser(req);
    const { provider } = providerParam.parse(req.params);
    const client = getProviderClient(provider);
    if (!client.getAuthUrl) {
      return {
        provider,
        mode: "client-token",
        message: "Capture the provider user token in the web client and POST it to callback.",
      };
    }
    const auth = client.getAuthUrl();
    await redis.setex(`oauth:${auth.state}`, 600, JSON.stringify({ userId: user.id, verifier: auth.verifier }));
    return { provider, url: auth.url, state: auth.state };
  });

  app.post("/v1/connections/:provider/callback", async (req) => {
    const user = await getCurrentUser(req);
    const { provider } = providerParam.parse(req.params);
    const body = callbackBody.parse(req.body);

    if (provider === "apple_music") {
      if (!body.musicUserToken) throw new Error("musicUserToken is required for Apple Music");
      await prisma.serviceConnection.upsert({
        where: { userId_provider: { userId: user.id, provider } },
        update: { encryptedUserToken: encryptToken(body.musicUserToken), scopes: ["music-user-token"] },
        create: {
          userId: user.id,
          provider,
          encryptedUserToken: encryptToken(body.musicUserToken),
          scopes: ["music-user-token"],
        },
      });
      return { ok: true, provider };
    }

    if (!body.code || !body.state) throw new Error("code and state are required");
    const statePayload = await redis.get(`oauth:${body.state}`);
    if (!statePayload) throw new Error("OAuth state expired or invalid");
    const parsedState = JSON.parse(statePayload) as { userId: string; verifier?: string };
    if (parsedState.userId !== user.id) throw new Error("OAuth state does not belong to current user");

    const tokens = await getProviderClient(provider).exchangeCode?.(body.code, parsedState.verifier);
    if (!tokens) throw new Error(`${provider} does not support OAuth code exchange`);
    await prisma.serviceConnection.upsert({
      where: { userId_provider: { userId: user.id, provider } },
      update: {
        encryptedAccessToken: encryptToken(tokens.accessToken),
        encryptedRefreshToken: tokens.refreshToken ? encryptToken(tokens.refreshToken) : undefined,
        tokenExpiresAt: tokens.expiresAt,
        providerAccountId: tokens.providerAccountId,
        scopes: tokens.scopes,
      },
      create: {
        userId: user.id,
        provider,
        encryptedAccessToken: encryptToken(tokens.accessToken),
        encryptedRefreshToken: tokens.refreshToken ? encryptToken(tokens.refreshToken) : undefined,
        tokenExpiresAt: tokens.expiresAt,
        providerAccountId: tokens.providerAccountId,
        scopes: tokens.scopes,
      },
    });
    await redis.del(`oauth:${body.state}`);
    return { ok: true, provider };
  });
}
