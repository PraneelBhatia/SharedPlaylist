import Link from "next/link";
import { notFound } from "next/navigation";
import type {
  AdminStatsDto,
  MatchStrategy,
  PairStatus,
  Provider,
} from "@sharedplaylist/shared-types";
import { adminApi } from "../../_lib/api-client";

export const dynamic = "force-dynamic";

const STATUS_ORDER: PairStatus[] = [
  "pending",
  "active",
  "needs_reauth",
  "paused",
  "ended",
];

const STATUS_LABEL: Record<PairStatus, string> = {
  pending: "Pending",
  active: "Active",
  needs_reauth: "Needs reconnect",
  paused: "Paused",
  ended: "Ended",
};

const MATCH_ORDER: Array<MatchStrategy | "unmatched"> = [
  "isrc",
  "fuzzy",
  "manual",
  "unmatched",
];

const MATCH_LABEL: Record<MatchStrategy | "unmatched", string> = {
  isrc: "ISRC",
  fuzzy: "Fuzzy",
  manual: "Manual",
  unmatched: "Unmatched",
};

const PROVIDER_ORDER: Provider[] = ["spotify", "apple_music", "youtube"];

const PROVIDER_LABEL: Record<Provider, string> = {
  spotify: "Spotify",
  apple_music: "Apple Music",
  youtube: "YouTube",
};

function formatNumber(n: number): string {
  return new Intl.NumberFormat("en-US").format(n);
}

function formatPercent(ratio: number, fractionDigits = 1): string {
  const pct = ratio * 100;
  if (!Number.isFinite(pct)) return "0%";
  const rounded = pct.toFixed(fractionDigits);
  // Strip trailing .0 for whole numbers
  const clean = rounded.replace(/\.0+$/, "");
  return `${clean}%`;
}

async function loadStats(): Promise<AdminStatsDto | null> {
  try {
    return await adminApi.stats();
  } catch {
    // ANY failure (403, 404, network) is opaque: the admin surface
    // must not be discoverable. notFound() in the caller handles it.
    return null;
  }
}

export default async function AdminStatsPage(): Promise<React.JSX.Element> {
  const stats = await loadStats();
  if (!stats) {
    notFound();
  }

  return (
    <main className="shell">
      <header className="masthead detail-masthead">
        <div className="detail-masthead-left">
          <Link href="/" className="detail-back" prefetch>
            <span aria-hidden>←</span>
            <span>Back to dashboard</span>
          </Link>
          <span className="admin-eyebrow">Admin</span>
          <h1>
            <em>Stats</em>
          </h1>
          <p className="detail-subhead">
            Aggregate view across all users, shares, and providers.
          </p>
        </div>
      </header>

      <UsersSection users={stats.users} />
      <SharesSection shares={stats.shares} />
      <SyncActivitySection syncActivity={stats.syncActivity} />
      <ProvidersSection providers={stats.providers} />
      <InviteFunnelSection inviteFunnel={stats.inviteFunnel} />
      <HealthSection health={stats.health} />
    </main>
  );
}

/* ------------------------------------------------------------------ */
/* USERS                                                                */
/* ------------------------------------------------------------------ */

function UsersSection({
  users,
}: {
  users: AdminStatsDto["users"];
}): React.JSX.Element {
  const cells: Array<{ label: string; value: number }> = [
    { label: "Total", value: users.total },
    { label: "Last 7d", value: users.last7d },
    { label: "Last 30d", value: users.last30d },
    { label: "Active 7d", value: users.activeLast7d },
  ];
  return (
    <section className="detail-section" aria-label="Users">
      <span className="detail-section-eyebrow">Users</span>
      <div className="admin-stat-row">
        {cells.map((cell) => (
          <div key={cell.label} className="admin-stat-cell">
            <span className="detail-analytics-number admin-stat-number">
              {formatNumber(cell.value)}
            </span>
            <span className="detail-analytics-label">{cell.label}</span>
          </div>
        ))}
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* SHARES                                                               */
/* ------------------------------------------------------------------ */

function SharesSection({
  shares,
}: {
  shares: AdminStatsDto["shares"];
}): React.JSX.Element {
  const segments = STATUS_ORDER.map((status) => ({
    key: status,
    label: STATUS_LABEL[status],
    value: shares.byStatus[status] ?? 0,
    statusClass: status,
  }));
  const segmentTotal = segments.reduce((sum, s) => sum + s.value, 0);

  return (
    <section className="detail-section" aria-label="Shares">
      <span className="detail-section-eyebrow">Shares</span>
      <div className="detail-analytics-grid">
        <div className="detail-analytics-stat">
          <span className="detail-analytics-number">
            {formatNumber(shares.total)}
          </span>
          <span className="detail-analytics-label">Total</span>
        </div>
        <div className="detail-analytics-divider" aria-hidden />
        <div className="detail-analytics-stat">
          <span className="detail-analytics-number">
            {formatNumber(shares.createdLast7d)}
          </span>
          <span className="detail-analytics-label">Created 7d</span>
        </div>
      </div>

      <div className="admin-breakdown" aria-label="Shares by status">
        <StackedBar
          segments={segments.map((s) => ({
            key: s.key,
            value: s.value,
            colorClass: `admin-stack-status-${s.statusClass}`,
          }))}
          total={segmentTotal}
        />
        <ul className="admin-legend">
          {segments.map((s) => (
            <li key={s.key} className="admin-legend-row">
              <span
                className={`admin-legend-swatch admin-stack-status-${s.statusClass}`}
                aria-hidden
              />
              <span className="admin-legend-label">{s.label}</span>
              <span className="admin-legend-value">{formatNumber(s.value)}</span>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* SYNC ACTIVITY                                                        */
/* ------------------------------------------------------------------ */

function SyncActivitySection({
  syncActivity,
}: {
  syncActivity: AdminStatsDto["syncActivity"];
}): React.JSX.Element {
  const segments = MATCH_ORDER.map((key) => ({
    key,
    label: MATCH_LABEL[key],
    value: syncActivity.matchStrategy[key] ?? 0,
    colorClass: `admin-stack-match-${key}`,
  }));
  const segmentTotal = segments.reduce((sum, s) => sum + s.value, 0);

  return (
    <section className="detail-section" aria-label="Sync activity">
      <span className="detail-section-eyebrow">Sync activity</span>
      <div className="detail-analytics-grid">
        <div className="detail-analytics-stat">
          <span className="detail-analytics-number">
            {formatNumber(syncActivity.totalTracksSynced)}
          </span>
          <span className="detail-analytics-label">Tracks synced</span>
        </div>
        <div className="detail-analytics-divider" aria-hidden />
        <div className="detail-analytics-stat">
          <span className="detail-analytics-number">
            {formatNumber(syncActivity.tracksSyncedLast7d)}
          </span>
          <span className="detail-analytics-label">Last 7d</span>
        </div>
      </div>

      <div className="admin-breakdown" aria-label="Match strategy distribution">
        <StackedBar segments={segments} total={segmentTotal} />
        <ul className="admin-legend">
          {segments.map((s) => (
            <li key={s.key} className="admin-legend-row">
              <span
                className={`admin-legend-swatch ${s.colorClass}`}
                aria-hidden
              />
              <span className="admin-legend-label">{s.label}</span>
              <span className="admin-legend-value">
                {formatNumber(s.value)}
                {segmentTotal > 0 ? (
                  <span className="admin-legend-pct">
                    {" · "}
                    {formatPercent(s.value / segmentTotal, 0)}
                  </span>
                ) : null}
              </span>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* PROVIDERS                                                            */
/* ------------------------------------------------------------------ */

function ProvidersSection({
  providers,
}: {
  providers: AdminStatsDto["providers"];
}): React.JSX.Element {
  const rows = PROVIDER_ORDER.map((provider) => ({
    key: provider,
    label: PROVIDER_LABEL[provider],
    value: providers[provider] ?? 0,
  }));
  const max = Math.max(1, ...rows.map((r) => r.value));

  return (
    <section className="detail-section" aria-label="Providers">
      <span className="detail-section-eyebrow">Providers</span>
      <ul className="admin-bar-list">
        {rows.map((row) => {
          const ratio = row.value / max;
          const widthPct = Math.max(row.value > 0 ? 2 : 0, ratio * 100);
          return (
            <li key={row.key} className="admin-bar-row">
              <span className="admin-bar-label">{row.label}</span>
              <span className="admin-bar-track" aria-hidden>
                <span
                  className={`admin-bar-fill admin-bar-fill-${row.key}`}
                  style={{ width: `${widthPct}%` }}
                />
              </span>
              <span className="admin-bar-value">{formatNumber(row.value)}</span>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* INVITE FUNNEL                                                        */
/* ------------------------------------------------------------------ */

function InviteFunnelSection({
  inviteFunnel,
}: {
  inviteFunnel: AdminStatsDto["inviteFunnel"];
}): React.JSX.Element {
  const { totalViews, totalConversions } = inviteFunnel;
  const conversion = totalViews > 0 ? totalConversions / totalViews : 0;

  return (
    <section
      className="detail-section detail-analytics"
      aria-label="Invite funnel"
    >
      <span className="detail-section-eyebrow">Invite funnel</span>
      <div className="detail-analytics-grid">
        <div className="detail-analytics-stat">
          <span className="detail-analytics-number">
            {formatNumber(totalViews)}
          </span>
          <span className="detail-analytics-label">
            {totalViews === 1 ? "View" : "Views"}
          </span>
        </div>
        <div className="detail-analytics-divider" aria-hidden />
        <div className="detail-analytics-stat">
          <span className="detail-analytics-number">
            {formatNumber(totalConversions)}
          </span>
          <span className="detail-analytics-label">Joined</span>
        </div>
        <div className="detail-analytics-divider" aria-hidden />
        <div className="detail-analytics-stat">
          <span className="detail-analytics-number">
            {formatPercent(conversion, 1)}
          </span>
          <span className="detail-analytics-label">Conversion</span>
        </div>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* HEALTH                                                               */
/* ------------------------------------------------------------------ */

function HealthSection({
  health,
}: {
  health: AdminStatsDto["health"];
}): React.JSX.Element {
  const errorRate = health.syncErrorRateLast24h;
  const errorTone =
    errorRate > 0.05 ? "danger" : errorRate > 0 ? "warning" : "ok";
  const reauthTone = health.needsReauthCount > 0 ? "warning" : "ok";

  return (
    <section className="detail-section" aria-label="Health">
      <span className="detail-section-eyebrow">Health</span>
      <div className="admin-health-grid">
        <div className={`admin-health-cell admin-health-${errorTone}`}>
          <span className="detail-analytics-number admin-stat-number">
            {formatPercent(errorRate, 2)}
          </span>
          <span className="detail-analytics-label">Sync error rate · 24h</span>
        </div>
        <div className={`admin-health-cell admin-health-${reauthTone}`}>
          <span className="detail-analytics-number admin-stat-number">
            {formatNumber(health.needsReauthCount)}
          </span>
          <span className="detail-analytics-label">Needs reconnect</span>
        </div>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* Stacked bar primitive                                                */
/* ------------------------------------------------------------------ */

function StackedBar({
  segments,
  total,
}: {
  segments: Array<{ key: string; value: number; colorClass: string }>;
  total: number;
}): React.JSX.Element {
  if (total <= 0) {
    return (
      <div className="admin-stack admin-stack-empty" aria-hidden>
        <span className="admin-stack-empty-fill" />
      </div>
    );
  }
  return (
    <div className="admin-stack" aria-hidden>
      {segments.map((s) => {
        if (s.value <= 0) return null;
        const widthPct = (s.value / total) * 100;
        return (
          <span
            key={s.key}
            className={`admin-stack-segment ${s.colorClass}`}
            style={{ width: `${widthPct}%` }}
          />
        );
      })}
    </div>
  );
}
