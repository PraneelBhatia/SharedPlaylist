"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import type { Provider, ShareDto } from "@sharedplaylist/shared-types";
import { ApiError, apiBase, playlistsApi, sharesApi } from "../../_lib/api-client";

type PlaylistItem = { id: string; name: string; trackCount?: number };

type LoadState =
  | { kind: "idle" }
  | { kind: "loading" }
  | { kind: "needs_connection" }
  | { kind: "error"; message: string }
  | { kind: "ready"; playlists: PlaylistItem[] };

const PROVIDERS: readonly Provider[] = ["spotify", "apple_music", "youtube"] as const;

const PROVIDER_LABEL: Record<Provider, string> = {
  spotify: "Spotify",
  apple_music: "Apple Music",
  youtube: "YouTube",
};

export default function SharePlaylistPage(): React.JSX.Element {
  const router = useRouter();

  const [step, setStep] = useState<"pick" | "done">("pick");
  const [provider, setProvider] = useState<Provider | null>(null);
  const [load, setLoad] = useState<LoadState>({ kind: "idle" });
  const [creating, setCreating] = useState<string | null>(null);
  const [createError, setCreateError] = useState<string | null>(null);
  const [share, setShare] = useState<ShareDto | null>(null);
  const [inviteToken, setInviteToken] = useState<string | null>(null);
  const [inviteExpires, setInviteExpires] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  async function pickProvider(next: Provider): Promise<void> {
    setProvider(next);
    setCreateError(null);
    setLoad({ kind: "loading" });
    try {
      const { playlists } = await playlistsApi.listByProvider(next);
      setLoad({ kind: "ready", playlists });
    } catch (err) {
      if (err instanceof ApiError && err.status >= 400 && err.status < 500) {
        setLoad({ kind: "needs_connection" });
      } else {
        setLoad({ kind: "error", message: "Couldn't load your playlists." });
      }
    }
  }

  async function pickPlaylist(playlist: PlaylistItem): Promise<void> {
    if (!provider) return;
    setCreating(playlist.id);
    setCreateError(null);
    try {
      const result = await sharesApi.create({
        sourceProvider: provider,
        sourcePlaylistId: playlist.id,
        sourcePlaylistName: playlist.name,
      });
      setShare(result.share);
      setInviteToken(result.inviteToken);
      setInviteExpires(result.inviteExpires);
      setStep("done");
    } catch (err) {
      const message =
        err instanceof ApiError
          ? `Couldn't create the share (${err.status}).`
          : "Couldn't create the share.";
      setCreateError(message);
    } finally {
      setCreating(null);
    }
  }

  function reset(): void {
    setStep("pick");
    setProvider(null);
    setLoad({ kind: "idle" });
    setCreating(null);
    setCreateError(null);
    setShare(null);
    setInviteToken(null);
    setInviteExpires(null);
    setCopied(false);
  }

  async function copyInvite(): Promise<void> {
    if (!inviteToken) return;
    try {
      const url = `${window.location.origin}/i/${inviteToken}`;
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      setCreateError("Couldn't copy. Select the link and copy manually.");
    }
  }

  return (
    <main className="shell">
      <header className="masthead">
        <h1>
          Share a <em>playlist</em>
        </h1>
        <Link href="/" className="share-cta" prefetch>
          <span>Back to dashboard</span>
        </Link>
      </header>

      {step === "pick" ? (
        <section className="new-step" aria-label="Pick a playlist to share">
          <span className="new-eyebrow">Step 1 — Where it lives</span>
          <div className="new-provider-row" role="tablist" aria-label="Streaming service">
            {PROVIDERS.map((p) => (
              <button
                key={p}
                role="tab"
                aria-selected={provider === p}
                className={`new-provider-btn${provider === p ? " active" : ""}`}
                onClick={() => {
                  void pickProvider(p);
                }}
                disabled={creating !== null}
              >
                {PROVIDER_LABEL[p]}
              </button>
            ))}
          </div>

          {provider === null ? (
            <p className="new-hint">Pick a service to see your playlists.</p>
          ) : null}

          {load.kind === "loading" ? (
            <p className="new-loading">Loading your playlists…</p>
          ) : null}

          {load.kind === "error" ? (
            <p className="inline-error">{load.message}</p>
          ) : null}

          {load.kind === "needs_connection" && provider ? (
            <div className="new-connect-panel">
              <span className="new-eyebrow">Not connected</span>
              <p className="new-connect-text">
                You haven&apos;t connected {PROVIDER_LABEL[provider]} yet. Connect it to see your
                playlists here.
              </p>
              <a
                className="empty-cta"
                href={`${apiBase}/v1/connections/${provider}/start`}
              >
                Connect {PROVIDER_LABEL[provider]}
              </a>
            </div>
          ) : null}

          {load.kind === "ready" ? (
            load.playlists.length === 0 ? (
              <p className="new-loading">
                No playlists found on {provider ? PROVIDER_LABEL[provider] : "this service"}.
              </p>
            ) : (
              <div className="new-pick-list" role="list">
                {load.playlists.map((playlist) => {
                  const isCreating = creating === playlist.id;
                  const isDisabled = creating !== null;
                  return (
                    <button
                      key={playlist.id}
                      role="listitem"
                      className="new-pick-row"
                      onClick={() => {
                        void pickPlaylist(playlist);
                      }}
                      disabled={isDisabled}
                      aria-busy={isCreating}
                    >
                      <span className="new-pick-title">{playlist.name}</span>
                      <span className="new-pick-meta">
                        {isCreating
                          ? "Creating share…"
                          : typeof playlist.trackCount === "number"
                            ? `${playlist.trackCount} ${playlist.trackCount === 1 ? "track" : "tracks"}`
                            : ""}
                      </span>
                    </button>
                  );
                })}
              </div>
            )
          ) : null}

          {createError ? <p className="inline-error">{createError}</p> : null}
        </section>
      ) : (
        <section className="new-step new-done" aria-label="Invite ready">
          <span className="new-eyebrow">Step 2 — Invite ready</span>
          <h2 className="new-done-title">
            Your invite is <em>ready</em>
          </h2>
          <p className="new-done-text">
            Send it to a friend on a different streaming service. They&apos;ll mirror your
            playlist on their side, and new songs will flow both ways.
          </p>

          {share ? (
            <span className="new-playlist-pill">
              {PROVIDER_LABEL[share.sourceProvider]} · {share.sourcePlaylistName}
            </span>
          ) : null}

          {inviteToken ? (
            <div className="invite">
              <div className="invite-row">
                <code className="invite-url">/i/{inviteToken}</code>
                <div className="invite-actions">
                  <button className="text-btn" onClick={copyInvite}>
                    Copy link
                  </button>
                  {copied ? <span className="copied-flash">Copied</span> : null}
                </div>
              </div>
              {inviteExpires ? (
                <p className="invite-meta">
                  Link expires {new Date(inviteExpires).toLocaleDateString()}
                </p>
              ) : null}
              {createError ? <p className="inline-error">{createError}</p> : null}
            </div>
          ) : null}

          <div className="new-actions">
            <button
              className="empty-cta"
              onClick={() => {
                router.push("/");
              }}
            >
              Done
            </button>
            <button className="text-btn muted" onClick={reset}>
              Share another
            </button>
          </div>
        </section>
      )}
    </main>
  );
}
