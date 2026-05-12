import { readFileSync } from "node:fs";
import { SignJWT, importPKCS8 } from "jose";
import type { ProviderPlaylist, ProviderTrack } from "@sharedplaylist/shared-types";
import { config, requireConfig } from "../config.ts";
import type { PlaylistSnapshot } from "./types.ts";

const API = "https://api.music.apple.com";

type AppleSong = {
  id: string;
  type: "songs";
  attributes: {
    name: string;
    artistName: string;
    albumName?: string;
    durationInMillis?: number;
    isrc?: string;
  };
};

let cachedDeveloperToken: { token: string; expiresAt: number } | null = null;

export async function getAppleDeveloperToken(): Promise<string> {
  if (process.env.APPLE_DEVELOPER_TOKEN_OVERRIDE) {
    return process.env.APPLE_DEVELOPER_TOKEN_OVERRIDE;
  }
  const now = Math.floor(Date.now() / 1000);
  if (cachedDeveloperToken && cachedDeveloperToken.expiresAt > now + 60) {
    return cachedDeveloperToken.token;
  }

  const pem = readFileSync(requireConfig("APPLE_PRIVATE_KEY_PATH"), "utf8");
  const privateKey = await importPKCS8(pem, "ES256");
  const expiresAt = now + 60 * 60;
  const token = await new SignJWT({})
    .setProtectedHeader({ alg: "ES256", kid: requireConfig("APPLE_KEY_ID") })
    .setIssuer(requireConfig("APPLE_TEAM_ID"))
    .setIssuedAt(now)
    .setExpirationTime(expiresAt)
    .sign(privateKey);

  cachedDeveloperToken = { token, expiresAt };
  return token;
}

async function appleFetch(path: string, musicUserToken?: string, init?: RequestInit): Promise<Response> {
  const developerToken = await getAppleDeveloperToken();
  return fetch(`${API}${path}`, {
    ...init,
    headers: {
      ...(init?.headers as Record<string, string> | undefined),
      Authorization: `Bearer ${developerToken}`,
      ...(musicUserToken ? { "Music-User-Token": musicUserToken } : {}),
      "Content-Type": "application/json",
    },
  });
}

function toProviderTrack(song: AppleSong): ProviderTrack {
  return {
    provider: "apple_music",
    id: song.id,
    title: song.attributes.name,
    artists: [song.attributes.artistName],
    album: song.attributes.albumName,
    durationMs: song.attributes.durationInMillis,
    isrc: song.attributes.isrc,
  };
}

export async function listAppleLibraryPlaylists(
  _accessToken: string,
  musicUserToken?: string,
): Promise<ProviderPlaylist[]> {
  if (!musicUserToken) throw new Error("Apple Music User Token is required");
  const out: ProviderPlaylist[] = [];
  let path: string | null = "/v1/me/library/playlists?limit=100";
  while (path) {
    const res = await appleFetch(path, musicUserToken);
    if (!res.ok) throw new Error(`Apple playlist list failed: ${res.status} ${await res.text()}`);
    const body = (await res.json()) as {
      data: { id: string; attributes: { name: string; canEdit?: boolean; lastModifiedDate?: string } }[];
      next?: string;
    };
    out.push(
      ...body.data.map((playlist) => ({
        provider: "apple_music" as const,
        id: playlist.id,
        name: playlist.attributes.name,
        canEdit: playlist.attributes.canEdit ?? true,
        cursor: playlist.attributes.lastModifiedDate,
      })),
    );
    path = body.next ?? null;
  }
  return out;
}

export async function getApplePlaylistSnapshot(
  _accessToken: string,
  playlistId: string,
  musicUserToken?: string,
): Promise<PlaylistSnapshot> {
  if (!musicUserToken) throw new Error("Apple Music User Token is required");
  const res = await appleFetch(`/v1/me/library/playlists/${playlistId}`, musicUserToken);
  if (!res.ok) throw new Error(`Apple playlist snapshot failed: ${res.status} ${await res.text()}`);
  const body = (await res.json()) as { data: { attributes?: { lastModifiedDate?: string } }[] };
  return { cursor: body.data[0]?.attributes?.lastModifiedDate ?? new Date().toISOString() };
}

export async function listApplePlaylistTracks(
  _accessToken: string,
  playlistId: string,
  musicUserToken?: string,
): Promise<ProviderTrack[]> {
  if (!musicUserToken) throw new Error("Apple Music User Token is required");
  const out: ProviderTrack[] = [];
  let path: string | null = `/v1/me/library/playlists/${playlistId}/tracks?limit=100`;
  while (path) {
    const res = await appleFetch(path, musicUserToken);
    if (!res.ok) throw new Error(`Apple playlist tracks failed: ${res.status} ${await res.text()}`);
    const body = (await res.json()) as {
      data: AppleSong[];
      next?: string;
    };
    out.push(...body.data.filter((item) => item.type === "songs").map(toProviderTrack));
    path = body.next ?? null;
  }
  return out;
}

export async function findAppleSongByIsrc(
  isrc: string,
  _accessToken?: string,
  _musicUserToken?: string,
): Promise<ProviderTrack | null> {
  const res = await appleFetch(
    `/v1/catalog/${config.APPLE_STOREFRONT}/songs?filter[isrc]=${encodeURIComponent(isrc)}`,
  );
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`Apple ISRC lookup failed: ${res.status} ${await res.text()}`);
  const body = (await res.json()) as { data: AppleSong[] };
  return body.data[0] ? toProviderTrack(body.data[0]) : null;
}

export async function searchAppleSongs(query: string): Promise<ProviderTrack[]> {
  const res = await appleFetch(
    `/v1/catalog/${config.APPLE_STOREFRONT}/search?types=songs&limit=10&term=${encodeURIComponent(query)}`,
  );
  if (!res.ok) throw new Error(`Apple search failed: ${res.status} ${await res.text()}`);
  const body = (await res.json()) as { results?: { songs?: { data: AppleSong[] } } };
  return body.results?.songs?.data.map(toProviderTrack) ?? [];
}

export async function addAppleSongsToPlaylist(
  _accessToken: string,
  playlistId: string,
  tracks: ProviderTrack[],
  musicUserToken?: string,
): Promise<void> {
  if (!musicUserToken) throw new Error("Apple Music User Token is required");
  const res = await appleFetch(`/v1/me/library/playlists/${playlistId}/tracks`, musicUserToken, {
    method: "POST",
    body: JSON.stringify({
      data: tracks.map((track) => ({ id: track.id, type: "songs" })),
    }),
  });
  if (!res.ok && res.status !== 204) {
    throw new Error(`Apple playlist write failed: ${res.status} ${await res.text()}`);
  }
}
