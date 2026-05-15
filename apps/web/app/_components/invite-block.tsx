"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import type { PairStatus } from "@sharedplaylist/shared-types";
import { sharesApi } from "../_lib/api-client";

function relativeExpiry(iso: string | null): string {
  if (!iso) return "no expiry";
  const ms = new Date(iso).getTime() - Date.now();
  if (ms <= 0) return "expired";
  const sec = Math.floor(ms / 1000);
  if (sec < 60) return `in ${sec}s`;
  const min = Math.floor(sec / 60);
  if (min < 60) return `in ${min}m`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `in ${hr}h`;
  const day = Math.floor(hr / 24);
  if (day < 30) return `in ${day}d`;
  return `in ${Math.floor(day / 30)}mo`;
}

type InviteBlockProps = {
  shareId: string;
  inviteToken: string;
  inviteExpires: string | null;
  status: PairStatus;
};

export function InviteBlock({
  shareId,
  inviteToken,
  inviteExpires,
}: InviteBlockProps): React.JSX.Element {
  const router = useRouter();
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, startTransition] = useTransition();

  const invitePath = `/i/${inviteToken}`;

  async function copyInvite(): Promise<void> {
    setError(null);
    try {
      const url = `${window.location.origin}${invitePath}`;
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      setError("Couldn't copy. Select the link and copy manually.");
    }
  }

  function runAction(action: () => Promise<unknown>): void {
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

  return (
    <div className="invite detail-invite">
      <div className="invite-row">
        <code className="invite-url">{invitePath}</code>
        <div className="invite-actions">
          <button
            type="button"
            className="text-btn"
            onClick={() => {
              void copyInvite();
            }}
            disabled={busy}
          >
            Copy link
          </button>
          {copied ? <span className="copied-flash">Copied</span> : null}
          <button
            type="button"
            className="text-btn"
            onClick={() => runAction(() => sharesApi.regenerateInvite(shareId))}
            disabled={busy}
          >
            Regenerate
          </button>
          <button
            type="button"
            className="text-btn muted"
            onClick={() => runAction(() => sharesApi.revokeInvite(shareId))}
            disabled={busy}
          >
            Revoke
          </button>
        </div>
      </div>
      {inviteExpires ? (
        <p className="invite-meta">Link expires {relativeExpiry(inviteExpires)}</p>
      ) : null}
      {error ? <p className="inline-error">{error}</p> : null}
    </div>
  );
}
