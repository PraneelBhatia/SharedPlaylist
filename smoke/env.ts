function required(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Missing required env var: ${name}. Did you copy .env.example to .env?`);
  return v;
}

function optional(name: string, fallback: string): string {
  return process.env[name] ?? fallback;
}

export const env = {
  spotify: {
    clientId: () => required("SPOTIFY_CLIENT_ID"),
    redirectUri: () => optional("SPOTIFY_REDIRECT_URI", "http://127.0.0.1:8888/callback"),
    sourcePlaylistId: () => required("SPOTIFY_SOURCE_PLAYLIST_ID"),
  },
  apple: {
    teamId: () => required("APPLE_TEAM_ID"),
    keyId: () => required("APPLE_KEY_ID"),
    privateKeyPath: () => required("APPLE_PRIVATE_KEY_PATH"),
    storefront: () => optional("APPLE_STOREFRONT", "us"),
    targetPlaylistId: () => required("APPLE_TARGET_PLAYLIST_ID"),
  },
  sync: {
    pollIntervalSeconds: () => Number(optional("POLL_INTERVAL_SECONDS", "30")),
  },
};
