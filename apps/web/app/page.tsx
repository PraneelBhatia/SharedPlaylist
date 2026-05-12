import type { ConnectionDto } from "@sharedplaylist/shared-types";

const apiBase = process.env.API_INTERNAL_BASE_URL ?? process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://127.0.0.1:4000";

async function fetchJson<T>(path: string, fallback: T): Promise<T> {
  try {
    const res = await fetch(`${apiBase}${path}`, { cache: "no-store" });
    if (!res.ok) return fallback;
    return (await res.json()) as T;
  } catch {
    return fallback;
  }
}

export default async function Home() {
  const health = await fetchJson<{ ok: boolean }>("/v1/health", { ok: false });
  const connections = await fetchJson<{ connections: ConnectionDto[]; youtubeBetaEnabled: boolean }>(
    "/v1/connections",
    { connections: [], youtubeBetaEnabled: false },
  );

  const providers = [
    { id: "spotify", name: "Spotify", stable: true },
    { id: "apple_music", name: "Apple Music", stable: true },
    { id: "youtube", name: "YouTube Music", stable: false },
  ];

  return (
    <main>
      <div className="topbar">
        <div>
          <h1>SharedPlaylist</h1>
          <p>Pair setup, provider status, and live sync activity.</p>
        </div>
        <span className={health.ok ? "status" : "status bad"}>{health.ok ? "API online" : "API offline"}</span>
      </div>

      <section className="grid">
        <div className="panel wide">
          <h2>Provider connections</h2>
          <div className="list">
            {providers.map((provider) => {
              const connection = connections.connections.find((item) => item.provider === provider.id);
              const disabled = provider.id === "youtube" && !connections.youtubeBetaEnabled;
              return (
                <div className="row" key={provider.id}>
                  <div>
                    <div className="label">{provider.name}</div>
                    <div className="subtle">
                      {disabled ? "Beta disabled" : provider.stable ? "Stable provider" : "Beta provider"}
                    </div>
                  </div>
                  <span className={connection?.connected ? "status" : "status bad"}>
                    {connection?.connected ? "Connected" : "Not connected"}
                  </span>
                  {!connection?.connected && !disabled ? (
                    <a className="action" href={`/v1/connections/${provider.id}/start`}>
                      Connect
                    </a>
                  ) : null}
                </div>
              );
            })}
          </div>
        </div>

        <div className="panel">
          <h2>Sync target</h2>
          <p>Spotify and Apple Music are the reliability target. YouTube is available only when beta mode is enabled.</p>
        </div>

        <div className="panel">
          <h2>Persistence</h2>
          <p>Postgres stores tokens, pair state, playlist cursors, track mappings, unmatched tracks, and sync events.</p>
        </div>

        <div className="panel">
          <h2>Scheduler</h2>
          <p>Redis and BullMQ schedule polling jobs. Workers rebuild schedules from Postgres after Redis restarts.</p>
        </div>
      </section>
    </main>
  );
}
