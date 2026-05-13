# SharedPlaylist

> One shared playlist. Two music apps. Zero compromises.

**SharedPlaylist** is an open-source agent that keeps a playlist in sync between
two people who use different streaming services. Your partner stays in Apple
Music. You stay in Spotify. The agent quietly mirrors adds in both directions,
so the same songs appear in both your playlists within ~30 seconds — without
either of you switching apps.

```
┌──────────────────┐    ┌─────────────────────────┐    ┌──────────────────┐
│  You             │    │   SharedPlaylist Agent  │    │  Your partner    │
│  (Spotify)       │◄──►│   polling + ISRC match  │◄──►│  (Apple Music)   │
│  Adds a song     │    │   bidirectional         │    │  Song appears    │
└──────────────────┘    └─────────────────────────┘    └──────────────────┘
```

## Status

🚧 **Phase 0 — Smoke Test.**
Validating the core matching mechanic with a single-user, one-direction
TypeScript script. See [`smoke/README.md`](smoke/README.md).

Roadmap:

1. **Phase 0** — Smoke test (Spotify → Apple Music via ISRC) ← *we are here*
2. **Phase 1** — OSS web app: multi-user, pairing, dashboard, bidirectional sync
3. **Phase 1.5** — YouTube Music integration
4. **Phase 2** — Polish, docs, contributing guide, hosted reference instance
5. **Phase 3** — Optional MCP server for conversational access via Claude/ChatGPT

## Why this exists

Every existing playlist-sync tool (Soundiiz, SongShift, TuneMyMusic, etc.) treats
sync as "one user, their own accounts." None of them is built for **two different
people on two different services** sharing a single playlist. SharedPlaylist
targets exactly that niche — especially couples and small friend groups.

It's also **open-source and self-hostable**. Your OAuth tokens never leave a
server you control.

## Architecture (high level)

- **TypeScript end-to-end** (Node 20+, Next.js, Fastify-style API)
- **Auth.js** for Spotify and Google OAuth; ~80 lines of custom code for Apple MusicKit JS
- **Postgres + Prisma** for persistent state
- **Redis + BullMQ** for adaptive polling jobs
- **ISRC-first matching**, fuzzy fallback (title + duration + Levenshtein)
- **Polling** (`snapshot_id` / `lastModifiedDate` / ETag short-circuits) — none of
  the music services offer webhooks


## Getting started (smoke test)

```bash
pnpm install
cp .env.example .env
# fill in Spotify and Apple credentials
pnpm smoke:auth:spotify
pnpm smoke:auth:apple
pnpm smoke:list-playlists
# paste the playlist IDs into .env
pnpm smoke:run
```

Detailed walkthrough: [`smoke/README.md`](smoke/README.md).

## Phase 1 app scaffold

The Phase 1 monorepo scaffold lives in:

- `apps/web` — Next.js dashboard and onboarding shell
- `apps/api` — Fastify `/v1` API plus BullMQ sync worker
- `packages/shared-types` — provider, playlist, match, and sync DTOs

Local app setup:

```bash
npm exec pnpm install
cp .env.example .env
# fill TOKEN_ENCRYPTION_KEY and provider credentials
# start Postgres and Redis locally using your preferred setup
npm exec pnpm db:generate
npm exec pnpm db:migrate
npm exec pnpm dev:api
npm exec pnpm dev:worker
npm exec pnpm dev:web
```

## Contributing

This is an open-source project. We'd love help with:
- YouTube Music integration (Phase 1.5)
- Matching algorithm improvements (better confidence scoring, more edge cases)
- Documentation and translations
- New service integrations (Tidal, Deezer, Amazon Music)

Bug reports and feature requests welcome via GitHub Issues.

## License

[MIT](LICENSE)

## Known limitations

- **Polling-only.** None of the major music services (Spotify, Apple, YT) expose
  webhooks for playlist changes. Latency is ~30s.
- **Apple Music user tokens expire ~6 months** with no refresh mechanism. Users
  must re-authorize twice a year. We surface a clear nudge in the dashboard.
- **YouTube Music has no ISRC.** Match accuracy on YT is lower (~95% mainstream,
  ~60–75% obscure).
- **Spotify dev-mode caps at 5 users** as of Feb 2026. Self-hosters control their
  own Spotify dev app and bring their own users.

## Acknowledgements

Inspired by — and learning from — prior art:
[SyncDisBoi](https://github.com/SilentVoid13/SyncDisBoi),
[ultrasonics](https://github.com/XDGFX/ultrasonics),
[ytmusicapi](https://github.com/sigma67/ytmusicapi),
[passport-apple-music](https://github.com/JuroOravec/passport-apple-music).
