import type { Provider } from "@sharedplaylist/shared-types";
import type { ProviderClient } from "./types.ts";
import {
  addSpotifyTracksToPlaylist,
  exchangeSpotifyCode,
  getSpotifyAuthUrl,
  getSpotifyPlaylistSnapshot,
  listSpotifyPlaylistTracks,
  listSpotifyPlaylists,
  refreshSpotifyAccessToken,
  searchSpotifyTracks,
} from "./spotify.ts";
import {
  addAppleSongsToPlaylist,
  findAppleSongByIsrc,
  getApplePlaylistSnapshot,
  listAppleLibraryPlaylists,
  listApplePlaylistTracks,
  searchAppleSongs,
} from "./apple-music.ts";
import {
  addYoutubeTracksToPlaylist,
  exchangeYoutubeCode,
  getYoutubeAuthUrl,
  getYoutubePlaylistSnapshot,
  listYoutubePlaylistTracks,
  listYoutubePlaylists,
  searchYoutubeTracks,
} from "./youtube.ts";

const clients: Record<Provider, ProviderClient> = {
  spotify: {
    provider: "spotify",
    getAuthUrl: getSpotifyAuthUrl,
    exchangeCode: exchangeSpotifyCode,
    refreshAccessToken: refreshSpotifyAccessToken,
    listPlaylists: listSpotifyPlaylists,
    getPlaylistSnapshot: getSpotifyPlaylistSnapshot,
    listPlaylistTracks: listSpotifyPlaylistTracks,
    addTracksToPlaylist: addSpotifyTracksToPlaylist,
    searchTracks: (query, accessToken) => {
      if (!accessToken) throw new Error("Spotify access token is required");
      return searchSpotifyTracks(accessToken, query);
    },
  },
  apple_music: {
    provider: "apple_music",
    listPlaylists: listAppleLibraryPlaylists,
    getPlaylistSnapshot: getApplePlaylistSnapshot,
    listPlaylistTracks: listApplePlaylistTracks,
    addTracksToPlaylist: addAppleSongsToPlaylist,
    findTrackByIsrc: findAppleSongByIsrc,
    searchTracks: searchAppleSongs,
  },
  youtube: {
    provider: "youtube",
    getAuthUrl: getYoutubeAuthUrl,
    exchangeCode: exchangeYoutubeCode,
    listPlaylists: listYoutubePlaylists,
    getPlaylistSnapshot: getYoutubePlaylistSnapshot,
    listPlaylistTracks: listYoutubePlaylistTracks,
    addTracksToPlaylist: addYoutubeTracksToPlaylist,
    searchTracks: (query, accessToken) => {
      if (!accessToken) throw new Error("YouTube access token is required");
      return searchYoutubeTracks(accessToken, query);
    },
  },
};

export function getProviderClient(provider: Provider): ProviderClient {
  return clients[provider];
}
