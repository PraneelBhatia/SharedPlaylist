import type {
  ShareDto,
  SharePreviewDto,
  InviteAnalyticsDto,
  AdminStatsDto,
  SyncEventDto,
} from "@sharedplaylist/shared-types";

const apiBase =
  process.env.API_INTERNAL_BASE_URL ??
  process.env.NEXT_PUBLIC_API_BASE_URL ??
  "http://127.0.0.1:4000";

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly path: string,
    public readonly bodyText: string,
  ) {
    super(`API ${path} ${status}: ${bodyText}`);
    this.name = "ApiError";
  }
}

async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${apiBase}${path}`, {
    cache: "no-store",
    ...init,
    headers: { "content-type": "application/json", ...(init?.headers ?? {}) },
  });
  if (!res.ok) {
    const bodyText = await res.text().catch(() => "");
    throw new ApiError(res.status, path, bodyText);
  }
  return res.json() as Promise<T>;
}

export const sharesApi = {
  list: () => apiFetch<{ shares: ShareDto[] }>("/v1/shares"),
  get: (id: string) => apiFetch<{ share: ShareDto }>(`/v1/shares/${id}`),
  preview: (token: string) =>
    apiFetch<SharePreviewDto>(`/v1/shares/preview/${token}`),
  create: (body: {
    sourceProvider: string;
    sourcePlaylistId: string;
    sourcePlaylistName: string;
  }) =>
    apiFetch<{ share: ShareDto; inviteToken: string; inviteExpires: string }>(
      "/v1/shares",
      {
        method: "POST",
        body: JSON.stringify(body),
      },
    ),
  accept: (token: string, body: { destinationProvider: string }) =>
    apiFetch<{ share: ShareDto }>(`/v1/shares/accept/${token}`, {
      method: "POST",
      body: JSON.stringify(body),
    }),
  leave: (id: string) =>
    apiFetch<{ share: { id: string; status: string } }>(
      `/v1/shares/${id}/leave`,
      { method: "POST" },
    ),
  pause: (id: string) =>
    apiFetch<{ share: ShareDto }>(`/v1/shares/${id}/pause`, { method: "POST" }),
  resume: (id: string) =>
    apiFetch<{ share: ShareDto }>(`/v1/shares/${id}/resume`, {
      method: "POST",
    }),
  regenerateInvite: (id: string) =>
    apiFetch<{ inviteToken: string; inviteExpires: string }>(
      `/v1/shares/${id}/regenerate-invite`,
      { method: "POST" },
    ),
  revokeInvite: (id: string) =>
    apiFetch<{ ok: true }>(`/v1/shares/${id}/invite`, { method: "DELETE" }),
  inviteAnalytics: (id: string) =>
    apiFetch<InviteAnalyticsDto>(`/v1/shares/${id}/invite-analytics`),
  events: (id: string) =>
    apiFetch<{ events: SyncEventDto[]; lastSyncedAt: string | null }>(
      `/v1/shares/${id}/events`,
    ),
};

export const playlistsApi = {
  listByProvider: (provider: string) =>
    apiFetch<{
      playlists: Array<{ id: string; name: string; trackCount?: number }>;
    }>(`/v1/playlists/${provider}`),
};

export const adminApi = {
  stats: () => apiFetch<AdminStatsDto>("/v1/admin/stats"),
};

export { apiBase };
