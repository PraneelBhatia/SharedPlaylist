import { env } from "./env.ts";
import {
  getPlaylistMeta,
  getPlaylistTracks,
  type SpotifyTrack,
} from "./spotify.ts";
import { addSongToLibraryPlaylist } from "./apple-music.ts";
import { matchSpotifyToApple } from "./matcher.ts";
import {
  alreadySynced,
  markSynced,
  flagUnmatched,
  getKv,
  setKv,
  STATE_KEYS,
} from "./state.ts";

const PAIR_KEY = "smoke";
const TARGET_SERVICE = "apple-music";

function fmtTrack(t: SpotifyTrack): string {
  const artist = t.artists.map((a) => a.name).join(", ");
  return `"${t.name}" — ${artist}`;
}

async function syncOnce(): Promise<void> {
  const sourcePlaylistId = env.spotify.sourcePlaylistId();
  const targetPlaylistId = env.apple.targetPlaylistId();

  const meta = await getPlaylistMeta(sourcePlaylistId);
  const lastSnapshot = getKv(STATE_KEYS.spotifyLastSnapshot);

  if (meta.snapshot_id === lastSnapshot) {
    console.log(`  · no change (snapshot ${meta.snapshot_id.slice(0, 8)}…)`);
    return;
  }

  console.log(
    `  ↻ playlist "${meta.name}" changed (${meta.tracks.total} tracks) — checking for new adds`,
  );
  const tracks = await getPlaylistTracks(sourcePlaylistId);

  let added = 0;
  let unmatched = 0;
  let skipped = 0;

  for (const track of tracks) {
    if (alreadySynced(PAIR_KEY, track.id, TARGET_SERVICE)) {
      skipped++;
      continue;
    }

    process.stdout.write(`  → ${fmtTrack(track)} ... `);
    const match = await matchSpotifyToApple(track);

    if (match.kind === "unmatched") {
      console.log(`✗ unmatched (${match.reason})`);
      flagUnmatched({
        sourceService: "spotify",
        sourceTrackId: track.id,
        title: track.name,
        artist: track.artists.map((a) => a.name).join(", "),
        isrc: track.external_ids.isrc ?? null,
        targetService: TARGET_SERVICE,
        candidates: match.candidates,
      });
      unmatched++;
      continue;
    }

    try {
      await addSongToLibraryPlaylist(targetPlaylistId, match.song.id);
      const conf = match.confidence.toFixed(2);
      console.log(`✓ ${match.kind} ${conf} → "${match.song.attributes.name}"`);
      markSynced({
        pairKey: PAIR_KEY,
        sourceTrackId: track.id,
        targetService: TARGET_SERVICE,
        targetTrackId: match.song.id,
        isrc: track.external_ids.isrc ?? null,
        matchConfidence: match.confidence,
      });
      added++;
    } catch (err) {
      console.log(`✗ write failed: ${(err as Error).message}`);
    }
  }

  setKv(STATE_KEYS.spotifyLastSnapshot, meta.snapshot_id);
  console.log(`  summary: +${added} added · ${unmatched} unmatched · ${skipped} already-synced`);
}

async function main(): Promise<void> {
  const interval = env.sync.pollIntervalSeconds();
  console.log("┌─────────────────────────────────────────────────────────────");
  console.log(`│  SharedPlaylist smoke test`);
  console.log(`│  Source: Spotify playlist ${env.spotify.sourcePlaylistId()}`);
  console.log(`│  Target: Apple Music playlist ${env.apple.targetPlaylistId()}`);
  console.log(`│  Poll:   every ${interval}s`);
  console.log("└─────────────────────────────────────────────────────────────");
  console.log("Press Ctrl+C to stop.\n");

  while (true) {
    const stamp = new Date().toISOString().slice(11, 19);
    console.log(`[${stamp}] checking...`);
    try {
      await syncOnce();
    } catch (err) {
      console.error("  ✗ sync error:", (err as Error).message);
    }
    await new Promise((r) => setTimeout(r, interval * 1000));
  }
}

main().catch((err) => {
  console.error("fatal:", err);
  process.exit(1);
});
