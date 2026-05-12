import { getAppleDeveloperToken } from "./auth/musickit-token.ts";
import { getKv, STATE_KEYS } from "./state.ts";
import { env } from "./env.ts";

const API = "https://api.music.apple.com";

export type AppleCatalogSong = {
  id: string;
  type: "songs";
  attributes: {
    name: string;
    artistName: string;
    albumName: string;
    durationInMillis: number;
    isrc: string;
    playParams?: { id: string; kind: string };
  };
};

export type AppleLibraryPlaylist = {
  id: string;
  attributes: {
    name: string;
    canEdit: boolean;
    lastModifiedDate?: string;
  };
};

function getMusicUserToken(): string {
  const mut = getKv(STATE_KEYS.appleMusicUserToken);
  if (!mut) {
    throw new Error(
      "No Apple Music User Token stored. Run `pnpm smoke:auth:apple` first to capture one via the browser.",
    );
  }
  return mut;
}

async function devFetch(path: string, init?: RequestInit): Promise<Response> {
  const devToken = await getAppleDeveloperToken();
  const res = await fetch(`${API}${path}`, {
    ...init,
    headers: {
      ...(init?.headers as Record<string, string> | undefined),
      Authorization: `Bearer ${devToken}`,
      "Content-Type": "application/json",
    },
  });
  return res;
}

async function userFetch(path: string, init?: RequestInit): Promise<Response> {
  const devToken = await getAppleDeveloperToken();
  const mut = getMusicUserToken();
  const res = await fetch(`${API}${path}`, {
    ...init,
    headers: {
      ...(init?.headers as Record<string, string> | undefined),
      Authorization: `Bearer ${devToken}`,
      "Music-User-Token": mut,
      "Content-Type": "application/json",
    },
  });
  return res;
}

/**
 * Look up a song in the Apple Music catalog by ISRC.
 * Returns the first matching song in the user's storefront, or null.
 */
export async function findSongByIsrc(isrc: string): Promise<AppleCatalogSong | null> {
  const storefront = env.apple.storefront();
  const res = await devFetch(
    `/v1/catalog/${storefront}/songs?filter[isrc]=${encodeURIComponent(isrc)}`,
  );
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`findSongByIsrc failed: ${res.status} ${await res.text()}`);
  const body = (await res.json()) as { data: AppleCatalogSong[] };
  return body.data[0] ?? null;
}

/**
 * Fallback: search the catalog by title + artist when ISRC fails.
 * Returns up to 5 candidates so the caller can score them.
 */
export async function searchSongs(query: string): Promise<AppleCatalogSong[]> {
  const storefront = env.apple.storefront();
  const res = await devFetch(
    `/v1/catalog/${storefront}/search?types=songs&limit=5&term=${encodeURIComponent(query)}`,
  );
  if (!res.ok) throw new Error(`searchSongs failed: ${res.status} ${await res.text()}`);
  const body = (await res.json()) as { results: { songs?: { data: AppleCatalogSong[] } } };
  return body.results.songs?.data ?? [];
}

export async function listLibraryPlaylists(): Promise<AppleLibraryPlaylist[]> {
  const out: AppleLibraryPlaylist[] = [];
  let path: string | null = "/v1/me/library/playlists?limit=100";
  while (path) {
    const res = await userFetch(path);
    if (!res.ok)
      throw new Error(`listLibraryPlaylists failed: ${res.status} ${await res.text()}`);
    const body = (await res.json()) as {
      data: AppleLibraryPlaylist[];
      next?: string;
    };
    out.push(...body.data);
    path = body.next ?? null;
  }
  return out;
}

/**
 * Add a catalog song to a library playlist.
 * Note: Apple Music API is NOT idempotent — calling this twice creates a duplicate.
 * Caller is responsible for de-duplication.
 */
export async function addSongToLibraryPlaylist(
  playlistId: string,
  catalogSongId: string,
): Promise<void> {
  const res = await userFetch(`/v1/me/library/playlists/${playlistId}/tracks`, {
    method: "POST",
    body: JSON.stringify({
      data: [{ id: catalogSongId, type: "songs" }],
    }),
  });
  if (!res.ok && res.status !== 201) {
    throw new Error(`addSongToLibraryPlaylist failed: ${res.status} ${await res.text()}`);
  }
}
