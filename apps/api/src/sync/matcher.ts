import type { MatchCandidate, Provider, ProviderTrack } from "@sharedplaylist/shared-types";
import { getProviderClient } from "../providers/index.ts";

const MIN_FUZZY_CONFIDENCE = 0.85;

export async function matchTrack(
  source: ProviderTrack,
  destinationProvider: Provider,
  destinationAccessToken?: string,
  destinationUserToken?: string,
): Promise<MatchCandidate | null> {
  const destination = getProviderClient(destinationProvider);

  if (source.isrc && destination.findTrackByIsrc) {
    const track = await destination.findTrackByIsrc(
      source.isrc,
      destinationAccessToken,
      destinationUserToken,
    );
    if (track) return { track, strategy: "isrc", confidence: 1 };
  }

  const query = `${source.title} ${source.artists[0] ?? ""}`.trim();
  const candidates = await destination.searchTracks(
    query,
    destinationAccessToken,
    destinationUserToken,
  );
  const best = candidates
    .map((track) => ({
      track,
      strategy: "fuzzy" as const,
      confidence: scoreCandidate(source, track, destinationProvider),
    }))
    .sort((a, b) => b.confidence - a.confidence)[0];

  return best && best.confidence >= MIN_FUZZY_CONFIDENCE ? best : null;
}

function scoreCandidate(source: ProviderTrack, candidate: ProviderTrack, destinationProvider: Provider): number {
  const titleScore = stringSimilarity(normalize(source.title), normalize(candidate.title));
  const durationScore = durationSimilarity(source.durationMs, candidate.durationMs);
  const base = 0.75 * titleScore + 0.25 * durationScore;
  return destinationProvider === "youtube" ? Math.min(base, 0.9) : base;
}

function normalize(value: string): string {
  return value
    .toLowerCase()
    .replace(/\([^)]*\)/g, "")
    .replace(/\[[^\]]*\]/g, "")
    .replace(/[^a-z0-9\s]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function stringSimilarity(a: string, b: string): number {
  if (!a && !b) return 1;
  if (!a || !b) return 0;
  const distance = levenshtein(a, b);
  return 1 - distance / Math.max(a.length, b.length);
}

function durationSimilarity(a?: number, b?: number): number {
  if (!a || !b) return 0.5;
  const diffSec = Math.abs(a - b) / 1000;
  if (diffSec <= 1) return 1;
  if (diffSec <= 3) return 0.9;
  if (diffSec <= 6) return 0.7;
  if (diffSec <= 12) return 0.4;
  return 0;
}

function levenshtein(a: string, b: string): number {
  const rows = a.length + 1;
  const cols = b.length + 1;
  const dist = Array.from({ length: rows }, () => new Array<number>(cols).fill(0));
  for (let i = 0; i < rows; i++) dist[i]![0] = i;
  for (let j = 0; j < cols; j++) dist[0]![j] = j;
  for (let i = 1; i < rows; i++) {
    for (let j = 1; j < cols; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      dist[i]![j] = Math.min(dist[i - 1]![j]! + 1, dist[i]![j - 1]! + 1, dist[i - 1]![j - 1]! + cost);
    }
  }
  return dist[a.length]![b.length]!;
}
