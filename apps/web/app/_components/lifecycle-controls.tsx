"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import type { PairStatus } from "@sharedplaylist/shared-types";
import { sharesApi } from "../_lib/api-client";

type LifecycleControlsProps = {
  shareId: string;
  status: PairStatus;
};

export function LifecycleControls({
  shareId,
  status,
}: LifecycleControlsProps): React.JSX.Element | null {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [busy, startTransition] = useTransition();

  if (status === "ended") return null;

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

  const canPause = status === "active";
  const canResume = status === "paused";

  return (
    <div className="detail-lifecycle">
      <div className="detail-lifecycle-actions">
        {canPause ? (
          <button
            type="button"
            className="detail-lifecycle-btn"
            onClick={() => runAction(() => sharesApi.pause(shareId))}
            disabled={busy}
          >
            Pause syncing
          </button>
        ) : null}
        {canResume ? (
          <button
            type="button"
            className="detail-lifecycle-btn"
            onClick={() => runAction(() => sharesApi.resume(shareId))}
            disabled={busy}
          >
            Resume syncing
          </button>
        ) : null}
        <button
          type="button"
          className="detail-lifecycle-btn destructive"
          onClick={() => runAction(() => sharesApi.leave(shareId))}
          disabled={busy}
        >
          Leave share
        </button>
      </div>
      {error ? <p className="inline-error">{error}</p> : null}
    </div>
  );
}
