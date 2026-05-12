import Database from "better-sqlite3";
import { mkdirSync } from "node:fs";
import { dirname, join } from "node:path";

const STATE_DIR = process.env.STATE_DIR ?? "./smoke/state";
mkdirSync(STATE_DIR, { recursive: true });

const db = new Database(join(STATE_DIR, "smoke.sqlite"));
db.pragma("journal_mode = WAL");

db.exec(`
  CREATE TABLE IF NOT EXISTS kv (
    key   TEXT PRIMARY KEY,
    value TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS synced_tracks (
    pair_key            TEXT NOT NULL,
    source_track_id     TEXT NOT NULL,
    target_service      TEXT NOT NULL,
    target_track_id     TEXT,
    isrc                TEXT,
    match_confidence    REAL,
    synced_at           TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (pair_key, source_track_id, target_service)
  );

  CREATE TABLE IF NOT EXISTS unmatched_tracks (
    id                INTEGER PRIMARY KEY AUTOINCREMENT,
    source_service    TEXT NOT NULL,
    source_track_id   TEXT NOT NULL,
    title             TEXT NOT NULL,
    artist            TEXT NOT NULL,
    isrc              TEXT,
    target_service    TEXT NOT NULL,
    candidates_json   TEXT,
    flagged_at        TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );
`);

export function setKv(key: string, value: string): void {
  db.prepare("INSERT OR REPLACE INTO kv(key, value) VALUES (?, ?)").run(key, value);
}

export function getKv(key: string): string | undefined {
  const row = db.prepare("SELECT value FROM kv WHERE key = ?").get(key) as
    | { value: string }
    | undefined;
  return row?.value;
}

export function getJson<T>(key: string): T | undefined {
  const raw = getKv(key);
  return raw ? (JSON.parse(raw) as T) : undefined;
}

export function setJson(key: string, value: unknown): void {
  setKv(key, JSON.stringify(value));
}

export function markSynced(args: {
  pairKey: string;
  sourceTrackId: string;
  targetService: string;
  targetTrackId: string | null;
  isrc: string | null;
  matchConfidence: number;
}): void {
  db.prepare(
    `INSERT OR REPLACE INTO synced_tracks
       (pair_key, source_track_id, target_service, target_track_id, isrc, match_confidence)
     VALUES (?, ?, ?, ?, ?, ?)`,
  ).run(
    args.pairKey,
    args.sourceTrackId,
    args.targetService,
    args.targetTrackId,
    args.isrc,
    args.matchConfidence,
  );
}

export function alreadySynced(pairKey: string, sourceTrackId: string, targetService: string): boolean {
  const row = db
    .prepare(
      "SELECT 1 FROM synced_tracks WHERE pair_key = ? AND source_track_id = ? AND target_service = ?",
    )
    .get(pairKey, sourceTrackId, targetService);
  return row !== undefined;
}

export function flagUnmatched(args: {
  sourceService: string;
  sourceTrackId: string;
  title: string;
  artist: string;
  isrc: string | null;
  targetService: string;
  candidates: unknown[];
}): void {
  db.prepare(
    `INSERT INTO unmatched_tracks
       (source_service, source_track_id, title, artist, isrc, target_service, candidates_json)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
  ).run(
    args.sourceService,
    args.sourceTrackId,
    args.title,
    args.artist,
    args.isrc,
    args.targetService,
    JSON.stringify(args.candidates),
  );
}

export const STATE_KEYS = {
  spotifyTokens: "spotify:tokens",
  spotifyPkceVerifier: "spotify:pkce-verifier",
  spotifyLastSnapshot: "spotify:last-snapshot",
  appleMusicUserToken: "apple:music-user-token",
} as const;
