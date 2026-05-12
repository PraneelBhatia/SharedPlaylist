# SharedPlaylist — Smoke Test

A throwaway-ish TypeScript script that validates the core mechanic:

> Add a song to a Spotify playlist → ISRC-match it on Apple Music → add it to an Apple Music library playlist.

If this works end-to-end on a popular song, then this works on an obscure indie track,
the core product idea is technically viable and we can move on to the real OSS web app.

The smoke test is **single-user**, **one-direction** (Spotify → Apple Music),
and runs on your laptop. No web server, no database, no public infra. Just one
script that prints to your terminal.

---

## Prerequisites

| | What | Where |
|---|---|---|
| **Node** | v20.6+ | `node --version` |
| **pnpm** | any recent | `npm install -g pnpm` |
| **Spotify dev app** | Client ID | [developer.spotify.com/dashboard](https://developer.spotify.com/dashboard) |
| **Apple MusicKit key** | `.p8`, Team ID, Key ID | [developer.apple.com/account](https://developer.apple.com/account) → Keys |
| **Spotify account** | for source playlist | yours |
| **Apple Music subscription** | for target playlist | yours |

If you haven't gathered the credentials yet, see the setup checklist
in `.superpowers/brainstorm/.../setup-checklist.html` (or scroll up in your
brainstorming session).

---

## One-time setup

```bash
# 1) Install deps
pnpm install

# 2) Configure your credentials
cp .env.example .env
# then edit .env and fill in:
#   SPOTIFY_CLIENT_ID
#   APPLE_TEAM_ID
#   APPLE_KEY_ID
#   APPLE_PRIVATE_KEY_PATH=/path/to/your/AuthKey_XXXXXXXXXX.p8
#   APPLE_STOREFRONT=us   (or your storefront)
# leave SPOTIFY_SOURCE_PLAYLIST_ID and APPLE_TARGET_PLAYLIST_ID blank for now

# 3) Authorize Spotify (opens browser, captures PKCE token)
pnpm smoke:auth:spotify

# 4) Authorize Apple Music (opens browser at 127.0.0.1:8889, captures MUT)
pnpm smoke:auth:apple

# 5) List your playlists so you can pick which ones to sync between
pnpm smoke:list-playlists
# copy the IDs into your .env:
#   SPOTIFY_SOURCE_PLAYLIST_ID=...
#   APPLE_TARGET_PLAYLIST_ID=...
```

---

## Run

```bash
pnpm smoke:run
```

The script polls Spotify every `POLL_INTERVAL_SECONDS` (default 30s).
It uses Spotify's `snapshot_id` to short-circuit when nothing has changed,
so the polling cost is small.

Now go open Spotify (mobile or desktop, doesn't matter) and add a song to
your source playlist. Within ~30s you should see something like:

```
[15:32:08] checking...
  ↻ playlist "SharedPlaylist Test" changed (3 tracks) — checking for new adds
  → "Blinding Lights" — The Weeknd ... ✓ isrc 1.00 → "Blinding Lights"
  summary: +1 added · 0 unmatched · 0 already-synced
```

Open Apple Music and check the target library playlist — the song should
be there.

---

## Test cases worth running

To validate the matcher properly, try adding these from Spotify:

| Song | What it tests |
|---|---|
| Recent pop hit (e.g. anything Top 40) | Baseline — ISRC should match instantly |
| A song with `(feat. ...)` in the title | Normalization handles parenthetical metadata |
| A remastered classic ("Strawberry Fields Forever — Remastered 2009") | Remasters often have a different ISRC; tests fuzzy fallback |
| A live version | Should match the live version, not the studio |
| An indie / regional track | Real test of matcher quality |
| A non-Western pop song (K-pop, Bollywood, Latin) | ISRC works, but storefront differences may matter |
| An explicit version when only clean exists on Apple | Should still match but flag confidence |

After running, check `smoke/state/smoke.sqlite` for the `unmatched_tracks` table
to see what didn't match.

---

## What the smoke test does NOT validate

- Bidirectional sync (Apple → Spotify) — not tested here, but the architecture is symmetric
- YouTube Music matching — different problem (no ISRC); separate spike
- Multi-user / pair flows — that's the web app's job
- Long-running token refresh (Apple MUT expires in ~6 months)
- Rate limits at scale (this is single-pair, single-poller)
- Removes / reorders — out of scope for v1

If the smoke test succeeds on most popular and a meaningful chunk of
obscure tracks, the core product idea is validated. Move on to the web app.

---

## File layout

```
smoke/
├── index.ts              Main polling loop
├── env.ts                Env var loaders with validation
├── state.ts              SQLite-backed state (tokens, snapshot_id, processed tracks)
├── spotify.ts            Spotify Web API client (read playlist, search by ISRC)
├── apple-music.ts        Apple Music API client (catalog search + library write)
├── matcher.ts            ISRC + fuzzy matching logic
├── list-playlists.ts     Helper: print your playlists with IDs
└── auth/
    ├── spotify-pkce.ts        Spotify OAuth PKCE flow (local server callback)
    ├── musickit-token.ts      Apple developer JWT (ES256, 1-hour expiry)
    ├── musickit-page.html     Browser page that captures Music User Token
    └── serve-musickit.ts      Local server that serves the page and stores the MUT
```

---

## Troubleshooting

**`Spotify token exchange failed: 400 redirect_uri_mismatch`**
The redirect URI in your Spotify dev app must EXACTLY match
`SPOTIFY_REDIRECT_URI` in `.env`. Use `http://127.0.0.1:8888/callback`,
not `localhost`. (Spotify rejected the `localhost` alias on 27 Nov 2025.)

**`Missing required env var: ...`**
You forgot to copy `.env.example` to `.env`, or you didn't fill in a field.

**MusicKit JS page says "MusicKit configuration failed"**
Most often: the developer token is invalid. Check:
- The `.p8` file path in `APPLE_PRIVATE_KEY_PATH` is correct
- `APPLE_TEAM_ID` matches your Apple Developer team ID (top-right of dev portal)
- `APPLE_KEY_ID` matches the Key ID shown on the key's page
- The key has the MusicKit capability enabled

**`findSongByIsrc failed: 404`**
The track isn't available on Apple Music in your storefront. The matcher
will fall back to fuzzy search.

**Spotify says "User not registered in the Developer Dashboard"**
Spotify Dev Mode caps at 5 test users since Feb 2026. Add the Spotify
account you're testing with as a "User" in your Spotify app dashboard.

---

## Cost

Zero. Spotify Web API and Apple Music API are both free.
Apple Developer Program ($99/yr) covers MusicKit key generation;
you already pay it.

---

## License

MIT — see [LICENSE](../LICENSE).
