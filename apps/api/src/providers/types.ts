import type { Provider, ProviderPlaylist, ProviderTrack } from "@sharedplaylist/shared-types";

export type OAuthStart = {
  url: string;
  state: string;
  verifier?: string;
};

export type OAuthTokens = {
  accessToken: string;
  refreshToken?: string;
  expiresAt?: Date;
  providerAccountId?: string;
  scopes: string[];
};

export type PlaylistSnapshot = {
  cursor: string;
  total?: number;
};

export type ProviderClient = {
  provider: Provider;
  getAuthUrl?(): OAuthStart;
  exchangeCode?(code: string, verifier?: string): Promise<OAuthTokens>;
  refreshAccessToken?(refreshToken: string): Promise<OAuthTokens>;
  listPlaylists(accessToken: string, userToken?: string): Promise<ProviderPlaylist[]>;
  getPlaylistSnapshot(accessToken: string, playlistId: string, userToken?: string): Promise<PlaylistSnapshot>;
  listPlaylistTracks(accessToken: string, playlistId: string, userToken?: string): Promise<ProviderTrack[]>;
  addTracksToPlaylist(accessToken: string, playlistId: string, tracks: ProviderTrack[], userToken?: string): Promise<void>;
  createPlaylist(accessToken: string, name: string, userToken?: string): Promise<{ playlistId: string; name: string }>;
  findTrackByIsrc?(isrc: string, accessToken?: string, userToken?: string): Promise<ProviderTrack | null>;
  searchTracks(query: string, accessToken?: string, userToken?: string): Promise<ProviderTrack[]>;
};
