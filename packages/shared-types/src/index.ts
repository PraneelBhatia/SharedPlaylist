export const PROVIDERS = ["spotify", "apple_music", "youtube"] as const;
export type Provider = (typeof PROVIDERS)[number];

export const STABLE_PROVIDERS = ["spotify", "apple_music"] as const;
export type StableProvider = (typeof STABLE_PROVIDERS)[number];

export type PairStatus = "pending" | "active" | "needs_reauth" | "paused" | "ended";
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

export type ShareMemberDto = {
  userId: string;
  displayName: string | null;
  provider: Provider;
  isCreator: boolean;
  joinedAt: string;
  needsReauth: boolean;
};

export type SharePlaylistDto = {
  userId: string;
  provider: Provider;
  playlistId: string;
  name: string | null;
};

export type ShareDto = {
  id: string;
  status: PairStatus;
  sourceProvider: Provider;
  sourcePlaylistId: string;
  sourcePlaylistName: string;
  creatorId: string;
  memberCount: number;
  memberCap: number;
  members: ShareMemberDto[];
  playlists: SharePlaylistDto[];
  inviteToken: string | null;
  inviteExpires: string | null;
  lastSyncedAt: string | null;
  createdAt: string;
  endedAt: string | null;
  endedById: string | null;
};

export type SharePreviewDto = {
  sourcePlaylistName: string;
  sourceProvider: Provider;
  creatorDisplayName: string | null;
  memberCount: number;
  memberCap: number;
};

export type InviteAnalyticsDto = {
  views: number;
  conversions: number;
  recentViews: Array<{
    viewedAt: string;
    converted: boolean;
  }>;
};

export type AdminStatsDto = {
  users: {
    total: number;
    last7d: number;
    last30d: number;
    activeLast7d: number;
  };
  shares: {
    total: number;
    byStatus: Record<PairStatus, number>;
    createdLast7d: number;
  };
  syncActivity: {
    totalTracksSynced: number;
    tracksSyncedLast7d: number;
    matchStrategy: Record<MatchStrategy | "unmatched", number>;
  };
  providers: Record<Provider, number>;
  inviteFunnel: {
    totalViews: number;
    totalConversions: number;
  };
  health: {
    syncErrorRateLast24h: number;
    needsReauthCount: number;
  };
};
