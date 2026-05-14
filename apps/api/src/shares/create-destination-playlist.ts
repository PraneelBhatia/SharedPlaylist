import type { Provider } from "@sharedplaylist/shared-types";
import { getProviderClient } from "../providers/index.ts";
import { getConnectionTokens } from "../sync/tokens.ts";

export async function createDestinationPlaylistFor(
  userId: string,
  sourcePlaylistName: string,
  provider: Provider,
): Promise<{ playlistId: string; name: string }> {
  const client = getProviderClient(provider);
  const tokens = await getConnectionTokens(userId, provider);
  return client.createPlaylist(tokens.accessToken, sourcePlaylistName, tokens.userToken);
}
