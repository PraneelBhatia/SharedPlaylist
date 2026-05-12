import type { ProviderPlaylist, ProviderTrack } from "@sharedplaylist/shared-types";
import { config, requireConfig } from "../config.ts";
import type { OAuthStart, OAuthTokens, PlaylistSnapshot } from "./types.ts";

const API = "https://www.googleapis.com/youtube/v3";
const TOKEN_URL = "https://oauth2.googleapis.com/token";
const AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth";
const SCOPES = ["https://www.googleapis.com/auth/youtube"].join(" ");

function assertYoutubeEnabled(): void {
  if (!config.YOUTUBE_BETA_ENABLED) {
    throw new Error("YouTube beta is disabled. Set YOUTUBE_BETA_ENABLED=true to use it.");
  }
}

async function youtubeFetch(accessToken: string, path: string, init?: RequestInit): Promise<Response> {
  assertYoutubeEnabled();
  const url = path.startsWith("http") ? path : `${API}${path}`;
  return fetch(url, {
    ...init,
    headers: {
      ...(init?.headers as Record<string, string> | undefined),
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
  });
}

export function getYoutubeAuthUrl(): OAuthStart {
  assertYoutubeEnabled();
  const state = crypto.randomUUID();
  const url = new URL(AUTH_URL);
  url.searchParams.set("client_id", requireConfig("GOOGLE_CLIENT_ID"));
  url.searchParams.set("redirect_uri", config.GOOGLE_REDIRECT_URI);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("scope", SCOPES);
  url.searchParams.set("access_type", "offline");
  url.searchParams.set("prompt", "consent");
  url.searchParams.set("state", state);
  return { url: url.toString(), state };
}

export async function exchangeYoutubeCode(code: string): Promise<OAuthTokens> {
  assertYoutubeEnabled();
  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      code,
      client_id: requireConfig("GOOGLE_CLIENT_ID"),
      client_secret: requireConfig("GOOGLE_CLIENT_SECRET"),
      redirect_uri: config.GOOGLE_REDIRECT_URI,
    }),
  });
  if (!res.ok) throw new Error(`YouTube token exchange failed: ${res.status} ${await res.text()}`);
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

export async function listYoutubePlaylists(accessToken: string): Promise<ProviderPlaylist[]> {
  const out: ProviderPlaylist[] = [];
  let pageToken = "";
  do {
    const res = await youtubeFetch(
      accessToken,
      `/playlists?part=snippet,contentDetails&mine=true&maxResults=50${pageToken ? `&pageToken=${pageToken}` : ""}`,
    );
    if (!res.ok) throw new Error(`YouTube playlist list failed: ${res.status} ${await res.text()}`);
    const body = (await res.json()) as {
      items: { id: string; etag: string; snippet: { title: string } }[];
      nextPageToken?: string;
    };
    out.push(
      ...body.items.map((playlist) => ({
        provider: "youtube" as const,
        id: playlist.id,
        name: playlist.snippet.title,
        canEdit: true,
        cursor: playlist.etag,
      })),
    );
    pageToken = body.nextPageToken ?? "";
  } while (pageToken);
  return out;
}

export async function getYoutubePlaylistSnapshot(
  accessToken: string,
  playlistId: string,
): Promise<PlaylistSnapshot> {
  const res = await youtubeFetch(accessToken, `/playlists?part=snippet&id=${encodeURIComponent(playlistId)}`);
  if (!res.ok) throw new Error(`YouTube playlist snapshot failed: ${res.status} ${await res.text()}`);
  const body = (await res.json()) as { items: { etag: string; contentDetails?: { itemCount?: number } }[] };
  const playlist = body.items[0];
  if (!playlist) throw new Error("YouTube playlist not found");
  return { cursor: playlist.etag, total: playlist.contentDetails?.itemCount };
}

export async function listYoutubePlaylistTracks(
  accessToken: string,
  playlistId: string,
): Promise<ProviderTrack[]> {
  const out: ProviderTrack[] = [];
  let pageToken = "";
  do {
    const res = await youtubeFetch(
      accessToken,
      `/playlistItems?part=snippet,contentDetails&playlistId=${encodeURIComponent(playlistId)}&maxResults=50${pageToken ? `&pageToken=${pageToken}` : ""}`,
    );
    if (!res.ok) throw new Error(`YouTube playlist items failed: ${res.status} ${await res.text()}`);
    const body = (await res.json()) as {
      items: {
        contentDetails: { videoId: string };
        snippet: { title: string; videoOwnerChannelTitle?: string };
      }[];
      nextPageToken?: string;
    };
    out.push(
      ...body.items.map((item) => ({
        provider: "youtube" as const,
        id: item.contentDetails.videoId,
        title: item.snippet.title,
        artists: item.snippet.videoOwnerChannelTitle ? [item.snippet.videoOwnerChannelTitle] : [],
      })),
    );
    pageToken = body.nextPageToken ?? "";
  } while (pageToken);
  return out;
}

export async function addYoutubeTracksToPlaylist(
  accessToken: string,
  playlistId: string,
  tracks: ProviderTrack[],
): Promise<void> {
  for (const track of tracks) {
    const res = await youtubeFetch(accessToken, "/playlistItems?part=snippet", {
      method: "POST",
      body: JSON.stringify({
        snippet: {
          playlistId,
          resourceId: { kind: "youtube#video", videoId: track.id },
        },
      }),
    });
    if (!res.ok) throw new Error(`YouTube playlist write failed: ${res.status} ${await res.text()}`);
  }
}

export async function searchYoutubeTracks(accessToken: string, query: string): Promise<ProviderTrack[]> {
  const res = await youtubeFetch(
    accessToken,
    `/search?part=snippet&type=video&maxResults=10&q=${encodeURIComponent(query)}`,
  );
  if (!res.ok) throw new Error(`YouTube search failed: ${res.status} ${await res.text()}`);
  const body = (await res.json()) as {
    items: { id: { videoId: string }; snippet: { title: string; channelTitle: string } }[];
  };
  return body.items.map((item) => ({
    provider: "youtube",
    id: item.id.videoId,
    title: item.snippet.title,
    artists: [item.snippet.channelTitle],
  }));
}
