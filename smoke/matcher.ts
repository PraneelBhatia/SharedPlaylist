import type { SpotifyTrack } from "./spotify.ts";
import { findSongByIsrc, searchSongs, type AppleCatalogSong } from "./apple-music.ts";

export type MatchResult =
  | { kind: "isrc"; song: AppleCatalogSong; confidence: 1.0 }
  | { kind: "fuzzy"; song: AppleCatalogSong; confidence: number }
  | { kind: "unmatched"; reason: string; candidates: AppleCatalogSong[] };

const MIN_FUZZY_CONFIDENCE = 0.7;

export async function matchSpotifyToApple(track: SpotifyTrack): Promise<MatchResult> {
  // Tier 1 — ISRC exact lookup
  const isrc = track.external_ids.isrc;
  if (isrc) {
    const song = await findSongByIsrc(isrc);
    if (song) {
      return { kind: "isrc", song, confidence: 1.0 };
    }
  }

  // Tier 2 — fuzzy search by title + artist, score candidates
  const primaryArtist = track.artists[0]?.name ?? "";
  const query = `${track.name} ${primaryArtist}`.trim();
  const candidates = await searchSongs(query);

  if (candidates.length === 0) {
    return { kind: "unmatched", reason: "no-candidates", candidates: [] };
  }

  const scored = candidates
    .map((c) => ({ song: c, score: scoreCandidate(track, c) }))
    .sort((a, b) => b.score - a.score);

  const best = scored[0];
  if (best && best.score >= MIN_FUZZY_CONFIDENCE) {
    return { kind: "fuzzy", song: best.song, confidence: best.score };
  }

  return {
    kind: "unmatched",
    reason: best ? `low-confidence:${best.score.toFixed(2)}` : "no-candidates",
    candidates,
  };
}

/**
 * Score how well an Apple Music catalog song matches a Spotify track.
 *
 * Heuristic — biases towards title and duration similarity. We drop artist from
 * the fuzzy match score because SyncDisBoi (OSS prior art) found artist metadata
 * is inconsistent across services (e.g. "feat. X" vs ", X"). It's still part of
 * the search query — just not part of the score.
 *
 * Confidence scale:
 *   1.0  = ISRC exact match (handled outside this function)
 *   0.9+ = title + duration both very close
 *   0.7+ = title close OR (title okay AND duration close)
 *   <0.7 = unmatched — surface to user
 *
 * TODO: Tune these weights based on real-world results from the smoke test.
 * If you (Praneel) notice the matcher is too aggressive with wrong matches,
 * raise MIN_FUZZY_CONFIDENCE above. If it's too conservative and skipping
 * valid matches, lower it.
 */
function scoreCandidate(spotify: SpotifyTrack, apple: AppleCatalogSong): number {
  const titleScore = stringSimilarity(
    normalize(spotify.name),
    normalize(apple.attributes.name),
  );
  const durationScore = durationSimilarity(
    spotify.duration_ms,
    apple.attributes.durationInMillis,
  );
  // Weighted: title matters more than duration, but mismatched duration is a strong veto
  return 0.7 * titleScore + 0.3 * durationScore;
}

function normalize(s: string): string {
  return s
    .toLowerCase()
    .replace(/\([^)]*\)/g, "") // drop "(feat. X)", "(Remastered)", etc.
    .replace(/\[[^\]]*\]/g, "")
    .replace(/[^a-z0-9\s]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function stringSimilarity(a: string, b: string): number {
  if (!a && !b) return 1;
  if (!a || !b) return 0;
  const distance = levenshtein(a, b);
  const maxLen = Math.max(a.length, b.length);
  return 1 - distance / maxLen;
}

function durationSimilarity(aMs: number, bMs: number): number {
  if (!aMs || !bMs) return 0;
  const diffSec = Math.abs(aMs - bMs) / 1000;
  if (diffSec <= 1) return 1;
  if (diffSec <= 3) return 0.9;
  if (diffSec <= 6) return 0.7;
  if (diffSec <= 12) return 0.4;
  return 0;
}

function levenshtein(a: string, b: string): number {
  const m = a.length;
  const n = b.length;
  if (m === 0) return n;
  if (n === 0) return m;

  let prev = new Array(n + 1);
  let curr = new Array(n + 1);
  for (let j = 0; j <= n; j++) prev[j] = j;

  for (let i = 1; i <= m; i++) {
    curr[0] = i;
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      curr[j] = Math.min(curr[j - 1] + 1, prev[j] + 1, prev[j - 1] + cost);
    }
    [prev, curr] = [curr, prev];
  }
  return prev[n];
}
