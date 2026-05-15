"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import type { Provider, ShareDto, ShareMemberDto } from "@sharedplaylist/shared-types";
import { sharesApi } from "../_lib/api-client";

const PROVIDER_LABEL: Record<Provider, string> = {
  spotify: "Spotify",
  apple_music: "Apple Music",
  youtube: "YouTube",
};

const STATUS_LABEL: Record<ShareDto["status"], string> = {
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

function MemberList({ members }: { members: ShareMemberDto[] }) {
  if (members.length >= 4) {
    return <span>{members.length} people</span>;
  }
  return (
    <>
      {members.map((member, index) => (
        <span key={member.userId}>
          {index > 0 ? <span className="sep">↔</span> : null}
          <span>{member.displayName || "Member"}</span>
          <span className="bullet"> · </span>
          <span>{PROVIDER_LABEL[member.provider] ?? member.provider}</span>
        </span>
      ))}
    </>
  );
}

export function ShareCard({ share }: { share: ShareDto }): React.JSX.Element {
  const router = useRouter();
  const [menuOpen, setMenuOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  const invitePath = share.inviteToken ? `/i/${share.inviteToken}` : null;
  const ended = share.status === "ended";
  const hasInviteLink = Boolean(invitePath) && !ended;

  function runAction(action: () => Promise<unknown>) {
    setMenuOpen(false);
    setError(null);
    startTransition(async () => {
      try {
        await action();
        router.refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Action failed.");
      }
    });
  }

  async function copyInvite() {
    if (!invitePath) return;
    try {
      const url = `${window.location.origin}${invitePath}`;
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      setError("Couldn't copy. Select the link and copy manually.");
    }
  }

  return (
    <article className={`card${ended ? " ended" : ""}`}>
      <div className="card-head">
        <span className={`status ${share.status}`}>
          <span className="dot" aria-hidden />
          {STATUS_LABEL[share.status]}
          {!ended && share.status !== "pending" ? (
            <>
              <span className="bullet"> · </span>
              {share.memberCount}/{share.memberCap}
            </>
          ) : null}
        </span>
        {!ended ? (
          <div className="menu-wrap">
            <button
              className="menu-trigger"
              aria-expanded={menuOpen}
              aria-haspopup="menu"
              aria-label="Share actions"
              onClick={() => setMenuOpen((open) => !open)}
              onBlur={() => setTimeout(() => setMenuOpen(false), 120)}
            >
              ⋯
            </button>
            {menuOpen ? (
              <div className="menu" role="menu">
                {share.status === "active" ? (
                  <button role="menuitem" onClick={() => runAction(() => sharesApi.pause(share.id))}>
                    Pause syncing
                  </button>
                ) : null}
                {share.status === "paused" ? (
                  <button role="menuitem" onClick={() => runAction(() => sharesApi.resume(share.id))}>
                    Resume syncing
                  </button>
                ) : null}
                {hasInviteLink ? (
                  <button role="menuitem" onClick={() => runAction(() => sharesApi.regenerateInvite(share.id))}>
                    Regenerate link
                  </button>
                ) : null}
                <button
                  role="menuitem"
                  className="destructive"
                  onClick={() => runAction(() => sharesApi.leave(share.id))}
                >
                  Leave share
                </button>
              </div>
            ) : null}
          </div>
        ) : null}
      </div>

      <h2 className="title">{share.sourcePlaylistName}</h2>
      <p className="members">
        <MemberList members={share.members} />
      </p>

      {share.status === "active" ? (
        <div className="status-row subtle">
          <span>Synced {relativeTime(share.lastSyncedAt)}</span>
        </div>
      ) : null}

      {share.status === "needs_reauth" ? (
        <div className="status-row">
          <span>Sync paused — a member needs to reconnect their account.</span>
        </div>
      ) : null}

      {share.status === "paused" ? (
        <div className="status-row subtle">
          <span>Sync paused. Resume from the ⋯ menu when you're ready.</span>
        </div>
      ) : null}

      {ended && share.endedAt ? (
        <div className="status-row subtle">
          <span>Ended {relativeTime(share.endedAt)}</span>
        </div>
      ) : null}

      {hasInviteLink && invitePath ? (
        <div className="invite">
          <div className="invite-row">
            <code className="invite-url">{invitePath}</code>
            <div className="invite-actions">
              <button className="text-btn" onClick={copyInvite}>
                Copy link
              </button>
              {copied ? <span className="copied-flash">Copied</span> : null}
              <button
                className="text-btn muted"
                onClick={() => runAction(() => sharesApi.revokeInvite(share.id))}
              >
                Revoke
              </button>
            </div>
          </div>
          {share.inviteExpires ? (
            <p className="invite-meta">Link expires {relativeTime(share.inviteExpires)}</p>
          ) : null}
          {error ? <p className="inline-error">{error}</p> : null}
        </div>
      ) : null}

      {!hasInviteLink && error ? <p className="inline-error">{error}</p> : null}
    </article>
  );
}
