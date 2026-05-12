import { refreshSpotifyAccessToken } from "./auth/spotify-pkce.ts";

const API = "https://api.spotify.com/v1";

/**
 * Spotify track shape used in this smoke test.
 *
 * Note: this reflects the POST-FEBRUARY-2026 endpoint layout.
 * The `/playlists/{id}/tracks` endpoint is gone; use `/playlists/{id}/items`.
 * The wrapper field is `items[].item` (not `items[].track`).
 */
export type SpotifyTrack = {
  id: string;
  uri: string;
  name: string;
  artists: { id: string; name: string }[];
  album: { id: string; name: string };
  duration_ms: number;
  external_ids: { isrc?: string };
  is_local: boolean;
};

type PlaylistItemsResponse = {
  href: string;
  items: { item: SpotifyTrack | null; added_at: string; is_local: boolean }[];
  next: string | null;
  total: number;
};

type PlaylistMeta = {
  id: string;
  name: string;
  snapshot_id: string;
  tracks: { total: number };
};

async function authedFetch(path: string, init?: RequestInit): Promise<Response> {
  const token = await refreshSpotifyAccessToken();
  const url = path.startsWith("http") ? path : `${API}${path}`;
  const res = await fetch(url, {
    ...init,
    headers: {
      ...(init?.headers as Record<string, string> | undefined),
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
  });
  if (res.status === 429) {
    const retryAfter = Number(res.headers.get("Retry-After") ?? "30");
    console.warn(`Spotify rate limited — waiting ${retryAfter}s`);
    await new Promise((r) => setTimeout(r, retryAfter * 1000));
    return authedFetch(path, init);
  }
  return res;
}

export async function getPlaylistMeta(playlistId: string): Promise<PlaylistMeta> {
  const res = await authedFetch(`/playlists/${playlistId}?fields=id,name,snapshot_id,tracks(total)`);
  if (!res.ok) throw new Error(`getPlaylistMeta failed: ${res.status} ${await res.text()}`);
  return (await res.json()) as PlaylistMeta;
}

export async function getPlaylistTracks(playlistId: string): Promise<SpotifyTrack[]> {
  const tracks: SpotifyTrack[] = [];
  let next: string | null =
    `${API}/playlists/${playlistId}/items?fields=items(item(id,uri,name,artists(id,name),album(id,name),duration_ms,external_ids,is_local),added_at,is_local),next&limit=50`;

  while (next) {
    const res = await authedFetch(next);
    if (!res.ok) throw new Error(`getPlaylistTracks failed: ${res.status} ${await res.text()}`);
    const body = (await res.json()) as PlaylistItemsResponse;
    for (const wrapper of body.items) {
      if (wrapper.is_local || !wrapper.item) continue;
      tracks.push(wrapper.item);
    }
    next = body.next;
  }
  return tracks;
}

export async function listMyPlaylists(): Promise<{ id: string; name: string; owner: string }[]> {
  const out: { id: string; name: string; owner: string }[] = [];
  let next: string | null = `${API}/me/playlists?limit=50`;
  while (next) {
    const res = await authedFetch(next);
    if (!res.ok) throw new Error(`listMyPlaylists failed: ${res.status} ${await res.text()}`);
    const body = (await res.json()) as {
      items: { id: string; name: string; owner: { display_name: string } }[];
      next: string | null;
    };
    for (const p of body.items) {
      out.push({ id: p.id, name: p.name, owner: p.owner.display_name });
    }
    next = body.next;
  }
  return out;
}

export async function searchTrackByIsrc(isrc: string): Promise<SpotifyTrack | null> {
  const res = await authedFetch(`/search?type=track&limit=10&q=isrc:${encodeURIComponent(isrc)}`);
  if (!res.ok) throw new Error(`searchTrackByIsrc failed: ${res.status} ${await res.text()}`);
  const body = (await res.json()) as { tracks: { items: SpotifyTrack[] } };
  return body.tracks.items[0] ?? null;
}

export async function addTracksToPlaylist(playlistId: string, uris: string[]): Promise<string> {
  if (uris.length === 0) throw new Error("No URIs to add");
  if (uris.length > 100) throw new Error("Spotify allows max 100 URIs per request");
  const res = await authedFetch(`/playlists/${playlistId}/items`, {
    method: "POST",
    body: JSON.stringify({ uris }),
  });
  if (!res.ok) throw new Error(`addTracksToPlaylist failed: ${res.status} ${await res.text()}`);
  const body = (await res.json()) as { snapshot_id: string };
  return body.snapshot_id;
}
