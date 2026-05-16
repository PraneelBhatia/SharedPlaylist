import Link from "next/link";
import type { ShareDto } from "@sharedplaylist/shared-types";
import { ApiError, sharesApi } from "../_lib/api-client";
import { ShareCard } from "../_components/share-card";

export const dynamic = "force-dynamic";

type LoadResult =
  | { kind: "ok"; shares: ShareDto[] }
  | { kind: "error"; message: string };

async function loadShares(): Promise<LoadResult> {
  try {
    const { shares } = await sharesApi.list();
    return { kind: "ok", shares };
  } catch (err) {
    if (err instanceof ApiError) {
      return { kind: "error", message: `Couldn't reach the API (${err.status}).` };
    }
    return { kind: "error", message: "Couldn't reach the API." };
  }
}

export default async function DashboardPage(): Promise<React.JSX.Element> {
  const result = await loadShares();
  const shares = result.kind === "ok" ? result.shares : [];
  const errorMessage = result.kind === "error" ? result.message : null;

  return (
    <main className="shell">
      <header className="masthead">
        <h1>
          Shared <em>playlists</em>
        </h1>
        <Link href="/share/new" className="share-cta" prefetch>
          <span className="plus">+</span>
          <span>Share a playlist</span>
        </Link>
      </header>

      {shares.length === 0 ? (
        <EmptyState errorMessage={errorMessage} />
      ) : (
        <section className="card-list" aria-label="Your shared playlists">
          {shares.map((share) => (
            <ShareCard key={share.id} share={share} />
          ))}
        </section>
      )}
    </main>
  );
}

function EmptyState({ errorMessage }: { errorMessage: string | null }): React.JSX.Element {
  return (
    <section className="empty" aria-label="Empty dashboard">
      <span className="empty-eyebrow">Nothing here yet</span>
      <h2>No shared playlists.</h2>
      <p>Share a playlist to start syncing songs with friends across Spotify, Apple Music, and YouTube.</p>
      <Link href="/share/new" className="empty-cta">
        Share a playlist
      </Link>
      {errorMessage ? <div className="empty-notice">{errorMessage}</div> : null}
    </section>
  );
}
