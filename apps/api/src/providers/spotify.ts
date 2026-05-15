import { createHash, randomBytes } from "node:crypto";
import type { ProviderPlaylist, ProviderTrack } from "@sharedplaylist/shared-types";
import { config, requireConfig } from "../config.ts";
import type { OAuthStart, OAuthTokens, PlaylistSnapshot } from "./types.ts";

const API = "https://api.spotify.com/v1";
const TOKEN_URL = "https://accounts.spotify.com/api/token";
const AUTH_URL = "https://accounts.spotify.com/authorize";

const SCOPES = [
  "playlist-read-private",
  "playlist-modify-private",
  "playlist-modify-public",
  "user-read-private",
].join(" ");

type SpotifyTrackItem = {
  id: string;
  uri: string;
  name: string;
  artists: { name: string }[];
  album?: { name: string };
  duration_ms?: number;
  external_ids?: { isrc?: string };
};

function base64url(buf: Buffer): string {
  return buf.toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function codeChallenge(verifier: string): string {
  return base64url(createHash("sha256").update(verifier).digest());
}

async function spotifyFetch(accessToken: string, path: string, init?: RequestInit): Promise<Response> {
  const url = path.startsWith("http") ? path : `${API}${path}`;
  const res = await fetch(url, {
    ...init,
    headers: {
      ...(init?.headers as Record<string, string> | undefined),
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
  });
  if (res.status === 429) {
    const retryAfter = Number(res.headers.get("Retry-After") ?? "30");
    await new Promise((resolve) => setTimeout(resolve, retryAfter * 1000));
    return spotifyFetch(accessToken, path, init);
  }
  return res;
}

function toProviderTrack(track: SpotifyTrackItem): ProviderTrack {
  return {
    provider: "spotify",
    id: track.id,
    uri: track.uri,
    title: track.name,
    artists: track.artists.map((artist) => artist.name),
    album: track.album?.name,
    durationMs: track.duration_ms,
    isrc: track.external_ids?.isrc,
  };
}

export function getSpotifyAuthUrl(): OAuthStart {
  const verifier = base64url(randomBytes(48));
  const state = base64url(randomBytes(24));
  const url = new URL(AUTH_URL);
  url.searchParams.set("client_id", requireConfig("SPOTIFY_CLIENT_ID"));
  url.searchParams.set("response_type", "code");
  url.searchParams.set("redirect_uri", config.SPOTIFY_REDIRECT_URI);
  url.searchParams.set("scope", SCOPES);
  url.searchParams.set("code_challenge_method", "S256");
  url.searchParams.set("code_challenge", codeChallenge(verifier));
  url.searchParams.set("state", state);
  return { url: url.toString(), state, verifier };
}

export async function exchangeSpotifyCode(code: string, verifier?: string): Promise<OAuthTokens> {
  if (!verifier) throw new Error("Spotify PKCE verifier is required");
  const body = new URLSearchParams({
    grant_type: "authorization_code",
    code,
    redirect_uri: config.SPOTIFY_REDIRECT_URI,
    client_id: requireConfig("SPOTIFY_CLIENT_ID"),
    code_verifier: verifier,
  });
  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });
  if (!res.ok) throw new Error(`Spotify token exchange failed: ${res.status} ${await res.text()}`);
  const json = (await res.json()) as {
    access_token: string;
    refresh_token?: string;
    expires_in?: number;
    scope?: string;
  };
  return {
    accessToken: json.access_token,
    refreshToken: json.refresh_token,
    expiresAt: json.expires_in ? new Date(Date.now() + json.expires_in * 1000) : undefined,
    scopes: json.scope?.split(" ") ?? [],
  };
}

export async function refreshSpotifyAccessToken(refreshToken: string): Promise<OAuthTokens> {
  const body = new URLSearchParams({
    grant_type: "refresh_token",
    refresh_token: refreshToken,
    client_id: requireConfig("SPOTIFY_CLIENT_ID"),
  });
  const clientSecret = config.SPOTIFY_CLIENT_SECRET;
  if (clientSecret) body.set("client_secret", clientSecret);
  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });
  if (!res.ok) throw new Error(`Spotify token refresh failed: ${res.status} ${await res.text()}`);
  const json = (await res.json()) as {
    access_token: string;
    refresh_token?: string;
    expires_in?: number;
    scope?: string;
  };
  return {
    accessToken: json.access_token,
    refreshToken: json.refresh_token ?? refreshToken,
    expiresAt: json.expires_in ? new Date(Date.now() + json.expires_in * 1000) : undefined,
    scopes: json.scope?.split(" ") ?? [],
  };
}

export async function listSpotifyPlaylists(accessToken: string): Promise<ProviderPlaylist[]> {
  const out: ProviderPlaylist[] = [];
  let next: string | null = `${API}/me/playlists?limit=50`;
  while (next) {
    const res = await spotifyFetch(accessToken, next);
    if (!res.ok) throw new Error(`Spotify playlist list failed: ${res.status} ${await res.text()}`);
    const body = (await res.json()) as {
      items: { id: string; name: string; collaborative: boolean; owner: { id: string } }[];
      next: string | null;
    };
    out.push(
      ...body.items.map((playlist) => ({
        provider: "spotify" as const,
        id: playlist.id,
        name: playlist.name,
        canEdit: true,
      })),
    );
    next = body.next;
  }
  return out;
}

export async function getSpotifyPlaylistSnapshot(
  accessToken: string,
  playlistId: string,
): Promise<PlaylistSnapshot> {
  const res = await spotifyFetch(accessToken, `/playlists/${playlistId}?fields=id,name,snapshot_id,items(total)`);
  if (!res.ok) throw new Error(`Spotify playlist snapshot failed: ${res.status} ${await res.text()}`);
  const body = (await res.json()) as { snapshot_id: string; items?: { total?: number } };
  return { cursor: body.snapshot_id, total: body.items?.total };
}

export async function listSpotifyPlaylistTracks(
  accessToken: string,
  playlistId: string,
): Promise<ProviderTrack[]> {
  const out: ProviderTrack[] = [];
  let next: string | null =
    `${API}/playlists/${playlistId}/items?fields=items(item(id,uri,name,artists(name),album(name),duration_ms,external_ids,is_local),is_local),next&limit=50`;
  while (next) {
    const res = await spotifyFetch(accessToken, next);
    if (!res.ok) throw new Error(`Spotify playlist items failed: ${res.status} ${await res.text()}`);
    const body = (await res.json()) as {
      items: { item: (SpotifyTrackItem & { is_local?: boolean }) | null; is_local?: boolean }[];
      next: string | null;
    };
    for (const wrapper of body.items) {
      if (wrapper.is_local || !wrapper.item || wrapper.item.is_local) continue;
      out.push(toProviderTrack(wrapper.item));
    }
    next = body.next;
  }
  return out;
}

export async function addSpotifyTracksToPlaylist(
  accessToken: string,
  playlistId: string,
  tracks: ProviderTrack[],
): Promise<void> {
  const uris = tracks.map((track) => track.uri).filter((uri): uri is string => Boolean(uri));
  for (let i = 0; i < uris.length; i += 100) {
    const batch = uris.slice(i, i + 100);
    const res = await spotifyFetch(accessToken, `/playlists/${playlistId}/items`, {
      method: "POST",
      body: JSON.stringify({ uris: batch }),
    });
    if (!res.ok) throw new Error(`Spotify playlist write failed: ${res.status} ${await res.text()}`);
  }
}

export async function createSpotifyPlaylist(
  accessToken: string,
  name: string,
): Promise<{ playlistId: string; name: string }> {
  const res = await spotifyFetch(accessToken, `/me/playlists`, {
    method: "POST",
    body: JSON.stringify({ name, public: false, collaborative: false }),
  });
  if (!res.ok) throw new Error(`Spotify playlist create failed: ${res.status} ${await res.text()}`);
  const body = (await res.json()) as { id: string; name?: string };
  return { playlistId: body.id, name: body.name ?? name };
}

export async function searchSpotifyTracks(
  accessToken: string,
  query: string,
): Promise<ProviderTrack[]> {
  const res = await spotifyFetch(accessToken, `/search?type=track&limit=10&q=${encodeURIComponent(query)}`);
  if (!res.ok) throw new Error(`Spotify search failed: ${res.status} ${await res.text()}`);
  const body = (await res.json()) as { tracks: { items: SpotifyTrackItem[] } };
  return body.tracks.items.map(toProviderTrack);
}
