import type { Provider } from "@sharedplaylist/shared-types";
import { prisma } from "../db/prisma.ts";
import { decryptToken, encryptToken } from "../crypto/token-vault.ts";
import { getProviderClient } from "../providers/index.ts";

export type ConnectionTokens = {
  accessToken: string;
  refreshToken?: string;
  userToken?: string;
};

export async function getConnectionTokens(userId: string, provider: Provider): Promise<ConnectionTokens> {
  const connection = await prisma.serviceConnection.findUnique({
    where: { userId_provider: { userId, provider } },
  });
  if (!connection) throw new Error(`No ${provider} connection for user ${userId}`);

  let accessToken = connection.encryptedAccessToken
    ? decryptToken(connection.encryptedAccessToken)
    : "";
  const refreshToken = connection.encryptedRefreshToken
    ? decryptToken(connection.encryptedRefreshToken)
    : undefined;
  const userToken = connection.encryptedUserToken ? decryptToken(connection.encryptedUserToken) : undefined;

  if (refreshToken && connection.tokenExpiresAt && connection.tokenExpiresAt <= new Date()) {
    const refreshed = await getProviderClient(provider).refreshAccessToken?.(refreshToken);
    if (refreshed) {
      accessToken = refreshed.accessToken;
      await prisma.serviceConnection.update({
        where: { id: connection.id },
        data: {
          encryptedAccessToken: encryptToken(refreshed.accessToken),
          encryptedRefreshToken: refreshed.refreshToken ? encryptToken(refreshed.refreshToken) : undefined,
          tokenExpiresAt: refreshed.expiresAt,
          scopes: refreshed.scopes,
        },
      });
    }
  }

  return { accessToken, refreshToken, userToken };
}
