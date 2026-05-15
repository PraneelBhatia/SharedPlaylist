"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import type { ShareDto } from "@sharedplaylist/shared-types";
import { ApiError, sharesApi } from "../_lib/api-client";

type RecoveryBlockProps = {
  share: ShareDto;
};

export function RecoveryBlock({ share }: RecoveryBlockProps): React.JSX.Element {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [busy, startTransition] = useTransition();

  function runAction(action: () => Promise<unknown>): void {
    setError(null);
    startTransition(async () => {
      try {
        await action();
        router.refresh();
      } catch (err) {
        if (err instanceof ApiError) {
          setError(err.bodyText || `Request failed (${err.status}).`);
        } else if (err instanceof Error) {
          setError(err.message);
        } else {
          setError("Recovery failed.");
        }
      }
    });
  }

  function handleCreate(): void {
    runAction(() => sharesApi.recover(share.id, { action: "create" }));
  }

  function handlePick(): void {
    // TODO(pairing-flow): replace with a real playlist picker that calls
    // sharesApi.recover(share.id, { action: "select", playlistId }).
    runAction(() => sharesApi.recover(share.id, { action: "create" }));
  }

  return (
    <div className="recovery-block" role="group" aria-label="Reconnect playlist">
      <span className="recovery-eyebrow">Needs reconnect</span>
      <p className="recovery-headline">
        A connection expired, so syncing stopped. Pick how to resume.
      </p>
      <div className="recovery-actions">
        <button
          type="button"
          className="recovery-btn primary"
          onClick={handleCreate}
          disabled={busy}
        >
          Create new playlist
        </button>
        <button
          type="button"
          className="recovery-btn"
          onClick={handlePick}
          disabled={busy}
        >
          Pick an existing one
        </button>
      </div>
      {error ? <p className="inline-error recovery-error">{error}</p> : null}
    </div>
  );
}
