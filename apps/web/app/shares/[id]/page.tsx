import Link from "next/link";
import type {
  InviteAnalyticsDto,
  PairStatus,
  Provider,
  ShareDto,
  ShareMemberDto,
  SyncEventDto,
  SyncEventKind,
} from "@sharedplaylist/shared-types";
import { ApiError, sharesApi } from "../../_lib/api-client";
import { InviteBlock } from "../../_components/invite-block";
import { LifecycleControls } from "../../_components/lifecycle-controls";
import { RecoveryBlock } from "../../_components/recovery-block";

export const dynamic = "force-dynamic";

const PROVIDER_LABEL: Record<Provider, string> = {
  spotify: "Spotify",
  apple_music: "Apple Music",
  youtube: "YouTube",
};

const STATUS_LABEL: Record<PairStatus, string> = {
  pending: "Waiting for partner",
  active: "Active",
  needs_reauth: "Needs reconnect",
  paused: "Paused",
  ended: "Ended",
};

function relativeTime(iso: string | null): string {
  if (!iso) return "never";
  const ms = Date.now() - new Date(iso).getTime();
  if (ms < 0) {
    const futureSec = Math.floor(-ms / 1000);
    if (futureSec < 60) return `in ${futureSec}s`;
    const futureMin = Math.floor(futureSec / 60);
    if (futureMin < 60) return `in ${futureMin}m`;
    const futureHr = Math.floor(futureMin / 60);
    if (futureHr < 24) return `in ${futureHr}h`;
    return `in ${Math.floor(futureHr / 24)}d`;
  }
  const sec = Math.floor(ms / 1000);
  if (sec < 60) return `${sec}s ago`;
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min}m ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const day = Math.floor(hr / 24);
  if (day < 30) return `${day}d ago`;
  return `${Math.floor(day / 30)}mo ago`;
}

function subheadFor(share: ShareDto): string {
  switch (share.status) {
    case "active":
      return share.lastSyncedAt
        ? `Synced ${relativeTime(share.lastSyncedAt)}`
        : "Waiting for first sync";
    case "paused":
      return "Sync paused";
    case "needs_reauth":
      return "A member needs to reconnect";
    case "pending":
      return "Waiting for someone to accept";
    case "ended":
      return share.endedAt
        ? `Ended ${relativeTime(share.endedAt)}`
        : "Ended";
  }
}

type EventLoad =
  | { kind: "ok"; events: SyncEventDto[] }
  | { kind: "error" };

type DetailLoad =
  | {
      kind: "ok";
      share: ShareDto;
      events: EventLoad;
      analytics: InviteAnalyticsDto | null;
    }
  | { kind: "unavailable" };

async function loadDetail(id: string): Promise<DetailLoad> {
  let share: ShareDto;
  try {
    const result = await sharesApi.get(id);
    share = result.share;
  } catch (err) {
    if (err instanceof ApiError) {
      // Generic unavailable for 403/404 — no info leakage.
      return { kind: "unavailable" };
    }
    console.error("[share-detail] get failed (network)", err);
    return { kind: "unavailable" };
  }

  const [eventsResult, analyticsResult] = await Promise.allSettled([
    sharesApi.events(id),
    sharesApi.inviteAnalytics(id),
  ]);

  let events: EventLoad;
  if (eventsResult.status === "fulfilled") {
    events = { kind: "ok", events: eventsResult.value.events };
  } else {
    if (!(eventsResult.reason instanceof ApiError)) {
      console.error("[share-detail] events failed", eventsResult.reason);
    }
    events = { kind: "error" };
  }

  let analytics: InviteAnalyticsDto | null = null;
  if (analyticsResult.status === "fulfilled") {
    analytics = analyticsResult.value;
  } else if (
    analyticsResult.reason instanceof ApiError &&
    (analyticsResult.reason.status === 403 ||
      analyticsResult.reason.status === 404)
  ) {
    // Non-creator viewing — silently skip the widget.
    analytics = null;
  } else {
    console.error(
      "[share-detail] inviteAnalytics failed",
      analyticsResult.reason,
    );
    analytics = null;
  }

  return { kind: "ok", share, events, analytics };
}

export default async function ShareDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<React.JSX.Element> {
  const { id } = await params;
  const result = await loadDetail(id);

  if (result.kind === "unavailable") {
    return <Unavailable />;
  }

  const { share, events, analytics } = result;
  const eventList =
    events.kind === "ok" ? events.events.slice(0, 50) : [];
  const showInvite =
    Boolean(share.inviteToken) && share.status !== "ended";

  return (
    <main className="shell">
      <header className="masthead detail-masthead">
        <div className="detail-masthead-left">
          <Link href="/" className="detail-back" prefetch>
            <span aria-hidden>←</span>
            <span>Back to dashboard</span>
          </Link>
          <h1>
            <em>{share.sourcePlaylistName}</em>
          </h1>
          <p className="detail-subhead">{subheadFor(share)}</p>
        </div>
        <span className={`status ${share.status}`}>
          <span className="dot" aria-hidden />
          {STATUS_LABEL[share.status]}
        </span>
      </header>

      <MembersSection
        members={share.members}
        memberCount={share.memberCount}
        memberCap={share.memberCap}
      />

      {share.status === "needs_reauth" ? (
        <section className="detail-section" aria-label="Reconnect">
          <span className="detail-section-eyebrow">Reconnect</span>
          <RecoveryBlock share={share} />
        </section>
      ) : null}

      {showInvite && share.inviteToken ? (
        <section className="detail-section" aria-label="Invite link">
          <span className="detail-section-eyebrow">Invite link</span>
          <InviteBlock
            shareId={share.id}
            inviteToken={share.inviteToken}
            inviteExpires={share.inviteExpires}
            status={share.status}
          />
        </section>
      ) : null}

      {share.status !== "ended" ? (
        <section className="detail-section" aria-label="Manage share">
          <span className="detail-section-eyebrow">Manage</span>
          <LifecycleControls shareId={share.id} status={share.status} />
        </section>
      ) : null}

      {analytics ? <AnalyticsSection analytics={analytics} /> : null}

      <EventLogSection events={eventList} error={events.kind === "error"} />
    </main>
  );
}

function MembersSection({
  members,
  memberCount,
  memberCap,
}: {
  members: ShareMemberDto[];
  memberCount: number;
  memberCap: number;
}): React.JSX.Element {
  return (
    <section className="detail-section" aria-label="Members">
      <span className="detail-section-eyebrow">Members</span>
      <ul className="detail-member-list">
        {members.map((member) => (
          <MemberRow key={member.userId} member={member} />
        ))}
      </ul>
      <p className="detail-member-count">
        {memberCount} of {memberCap} people
      </p>
    </section>
  );
}

function MemberRow({ member }: { member: ShareMemberDto }): React.JSX.Element {
  return (
    <li className="detail-member-row">
      <div className="detail-member-identity">
        <span className="detail-member-name">
          {member.displayName || "Member"}
        </span>
        <span className="detail-member-meta">
          {PROVIDER_LABEL[member.provider] ?? member.provider}
        </span>
      </div>
      <div className="detail-member-tags">
        {member.isCreator ? (
          <span className="detail-tag">Creator</span>
        ) : null}
        {member.needsReauth ? (
          <span className="detail-tag detail-tag-warning">
            Needs reconnect
          </span>
        ) : null}
      </div>
    </li>
  );
}

function AnalyticsSection({
  analytics,
}: {
  analytics: InviteAnalyticsDto;
}): React.JSX.Element {
  const recent = analytics.recentViews.slice(0, 5);
  return (
    <section className="detail-section detail-analytics" aria-label="Invite funnel">
      <span className="detail-section-eyebrow">Invite funnel</span>
      <div className="detail-analytics-grid">
        <div className="detail-analytics-stat">
          <span className="detail-analytics-number">{analytics.views}</span>
          <span className="detail-analytics-label">
            {analytics.views === 1 ? "View" : "Views"}
          </span>
        </div>
        <div className="detail-analytics-divider" aria-hidden />
        <div className="detail-analytics-stat">
          <span className="detail-analytics-number">
            {analytics.conversions}
          </span>
          <span className="detail-analytics-label">Joined</span>
        </div>
      </div>
      {recent.length > 0 ? (
        <div className="detail-recent-views">
          <span className="detail-recent-views-label">Recent views</span>
          <ul>
            {recent.map((view, idx) => (
              <li
                key={`${view.viewedAt}-${idx}`}
                className="detail-recent-view-row"
              >
                <span className="detail-recent-view-time">
                  {relativeTime(view.viewedAt)}
                </span>
                <span
                  className={`detail-recent-view-state${view.converted ? " converted" : ""}`}
                >
                  {view.converted ? "✓ Joined" : "Opened"}
                </span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </section>
  );
}

const KIND_COLOR: Record<SyncEventKind, string> = {
  written: "detail-event-kind-written",
  failed: "detail-event-kind-failed",
  matched: "detail-event-kind-matched",
  detected: "detail-event-kind-muted",
  skipped: "detail-event-kind-muted",
  unmatched: "detail-event-kind-muted",
};

function EventLogSection({
  events,
  error,
}: {
  events: SyncEventDto[];
  error: boolean;
}): React.JSX.Element {
  return (
    <section className="detail-section" aria-label="Sync activity">
      <span className="detail-section-eyebrow">Sync activity</span>
      {error ? (
        <p className="detail-empty">Couldn&rsquo;t load activity.</p>
      ) : events.length === 0 ? (
        <p className="detail-empty">No sync activity yet.</p>
      ) : (
        <ol className="detail-event-log" aria-label="Recent sync events">
          {events.map((event) => (
            <li key={event.id} className="detail-event-row">
              <span className="detail-event-time">
                {relativeTime(event.createdAt)}
              </span>
              <span
                className={`detail-event-kind ${KIND_COLOR[event.kind]}`}
              >
                <span className="detail-event-dot" aria-hidden />
                {event.kind}
              </span>
              <span className="detail-event-provider">
                {PROVIDER_LABEL[event.provider] ?? event.provider}
              </span>
              <span className="detail-event-message">{event.message}</span>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}

function Unavailable(): React.JSX.Element {
  return (
    <main className="shell">
      <section
        className="invite-page invite-page-unavailable"
        aria-label="Share unavailable"
      >
        <span className="invite-page-eyebrow">Share unavailable</span>
        <h1 className="invite-page-title invite-page-title-muted">
          Share not found or you don&rsquo;t have access.
        </h1>
        <p className="invite-page-subtitle">
          The share may have ended, the link may be wrong, or you may not be a
          member.
        </p>
        <Link href="/" className="invite-page-back">
          Back to dashboard
        </Link>
      </section>
    </main>
  );
}
