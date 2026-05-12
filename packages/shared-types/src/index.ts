export const PROVIDERS = ["spotify", "apple_music", "youtube"] as const;
export type Provider = (typeof PROVIDERS)[number];

export const STABLE_PROVIDERS = ["spotify", "apple_music"] as const;
export type StableProvider = (typeof STABLE_PROVIDERS)[number];

export type PairStatus = "pending" | "active" | "paused";
export type MatchStrategy = "isrc" | "fuzzy" | "manual";
export type SyncEventKind =
  | "detected"
  | "matched"
  | "skipped"
  | "written"
  | "failed"
  | "unmatched";

export type ProviderTrack = {
  provider: Provider;
  id: string;
  uri?: string;
  title: string;
  artists: string[];
  album?: string;
  durationMs?: number;
  isrc?: string;
};

export type ProviderPlaylist = {
  provider: Provider;
  id: string;
  name: string;
  canEdit: boolean;
  cursor?: string;
};

export type MatchCandidate = {
  track: ProviderTrack;
  strategy: MatchStrategy;
  confidence: number;
};

export type SyncEventDto = {
  id: string;
  pairId: string;
  kind: SyncEventKind;
  provider: Provider;
  message: string;
  confidence?: number;
  createdAt: string;
};

export type ConnectionDto = {
  provider: Provider;
  connected: boolean;
  expiresAt?: string;
  needsReauth: boolean;
};

export type PairDto = {
  id: string;
  status: PairStatus;
  createdAt: string;
  playlistsConfigured: boolean;
};

export function isProvider(value: string): value is Provider {
  return PROVIDERS.includes(value as Provider);
}

export function isStableProvider(value: Provider): value is StableProvider {
  return STABLE_PROVIDERS.includes(value as StableProvider);
}
