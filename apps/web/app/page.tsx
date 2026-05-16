import Link from "next/link";
import {
  SpotifyLogo,
  AppleMusicLogo,
  YouTubeMusicLogo,
} from "./_components/provider-logos";

export const dynamic = "force-static";

const apiBase =
  process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://127.0.0.1:4000";

function oauthStart(provider: "spotify" | "apple_music" | "youtube") {
  return `${apiBase}/v1/connections/${provider}/start?returnTo=/welcome`;
}

export default function LandingPage(): React.JSX.Element {
  return (
    <main className="landing">
      <nav className="landing-nav">
        <span className="landing-wordmark">
          Shared<em>playlist</em>
        </span>
        <div className="landing-nav-links">
          <a
            href="https://github.com/PraneelBhatia/SharedPlaylist"
            target="_blank"
            rel="noreferrer"
            className="landing-nav-link"
          >
            GitHub ↗
          </a>
          <Link href="/dashboard" className="landing-nav-link">
            Sign in
          </Link>
        </div>
      </nav>

      <section className="hero">
        <div className="hero-eyebrow">
          <span className="hero-dot" aria-hidden />
          Now syncing
        </div>
        <h1 className="hero-title">
          One <em>shared playlist.</em>
          <br />
          Two music apps.
        </h1>
        <p className="hero-lede">
          You on Spotify. Your partner on Apple Music. Your friend on YouTube
          Music. Add a song on any of them — it shows up on all of them, in
          about 30 seconds.
        </p>

        <div className="hero-cta-stack">
          <span className="hero-cta-label">Sign in to get started</span>
          <div className="hero-cta-row">
            <a className="oauth-btn oauth-spotify" href={oauthStart("spotify")}>
              <SpotifyLogo size={20} monochrome className="oauth-logo" />
              <span>Continue with Spotify</span>
            </a>
            <a
              className="oauth-btn oauth-apple"
              href={oauthStart("apple_music")}
            >
              <AppleMusicLogo size={20} monochrome className="oauth-logo" />
              <span>Continue with Apple Music</span>
            </a>
            <a className="oauth-btn oauth-youtube" href={oauthStart("youtube")}>
              <YouTubeMusicLogo size={20} monochrome className="oauth-logo" />
              <span>Continue with YouTube Music</span>
            </a>
          </div>
          <p className="hero-cta-foot">
            No signup form. We don&apos;t store your email or a password.
            Your music account is your account.
          </p>
        </div>
      </section>

      <section className="howit">
        <div className="howit-eyebrow">How it works</div>
        <ol className="howit-steps">
          <li className="howit-step">
            <span className="howit-num">01</span>
            <h3>Sign in with your music app</h3>
            <p>
              One click, no signup form. Connect Spotify, Apple Music, or
              YouTube Music.
            </p>
          </li>
          <li className="howit-step">
            <span className="howit-num">02</span>
            <h3>Pick a playlist to share</h3>
            <p>
              Choose one of yours. We mint a private 7-day invite link — yours
              to send.
            </p>
          </li>
          <li className="howit-step">
            <span className="howit-num">03</span>
            <h3>They join from any service</h3>
            <p>
              The other person opens the link, picks their music app, and gets
              a matching playlist auto-created on their side.
            </p>
          </li>
          <li className="howit-step">
            <span className="howit-num">04</span>
            <h3>Everything syncs both ways</h3>
            <p>
              Add or remove a track on either side — within ~30 seconds it
              shows up everywhere. Up to 5 people in one shared playlist.
            </p>
          </li>
        </ol>
      </section>

      <section className="providers">
        <div className="providers-eyebrow">Works across</div>
        <div className="providers-row">
          <div className="provider-chip">
            <SpotifyLogo size={28} />
            <span>Spotify</span>
          </div>
          <div className="provider-chip">
            <AppleMusicLogo size={28} />
            <span>Apple Music</span>
          </div>
          <div className="provider-chip">
            <YouTubeMusicLogo size={28} />
            <span>YouTube Music</span>
          </div>
        </div>
        <p className="providers-note">
          Track matching is ISRC-first (the universal song ID); we fall back to
          title + artist + duration when a service doesn&apos;t expose ISRC.
        </p>
      </section>

      <section className="ethos">
        <div className="ethos-grid">
          <div className="ethos-block">
            <h4>For two, mostly.</h4>
            <p>
              Built for couples first. Small friend groups too — up to 5
              people in a single shared playlist.
            </p>
          </div>
          <div className="ethos-block">
            <h4>No email. No password.</h4>
            <p>
              Provider OAuth is the only authentication. We don&apos;t collect
              an email and we can&apos;t send you marketing — by design.
            </p>
          </div>
          <div className="ethos-block">
            <h4>Open source.</h4>
            <p>
              MIT-licensed. Self-host on your own machine, or use this hosted
              reference instance. Code on{" "}
              <a
                href="https://github.com/PraneelBhatia/SharedPlaylist"
                target="_blank"
                rel="noreferrer"
                className="ethos-link"
              >
                GitHub
              </a>
              .
            </p>
          </div>
          <div className="ethos-block">
            <h4>Your tokens stay here.</h4>
            <p>
              OAuth tokens are encrypted at rest with AES-256-GCM. No third
              party analytics. No tracking pixels.
            </p>
          </div>
        </div>
      </section>

      <section className="finale">
        <h2>
          Ready to share <em>your</em> playlist?
        </h2>
        <div className="finale-cta-row">
          <a className="oauth-btn oauth-spotify" href={oauthStart("spotify")}>
            <SpotifyLogo size={20} monochrome className="oauth-logo" />
            <span>Spotify</span>
          </a>
          <a
            className="oauth-btn oauth-apple"
            href={oauthStart("apple_music")}
          >
            <AppleMusicLogo size={20} monochrome className="oauth-logo" />
            <span>Apple Music</span>
          </a>
          <a className="oauth-btn oauth-youtube" href={oauthStart("youtube")}>
            <YouTubeMusicLogo size={20} monochrome className="oauth-logo" />
            <span>YouTube Music</span>
          </a>
        </div>
      </section>

      <footer className="landing-foot">
        <span className="landing-foot-wordmark">
          Shared<em>playlist</em>
        </span>
        <span className="landing-foot-meta">
          MIT &middot;{" "}
          <a
            href="https://github.com/PraneelBhatia/SharedPlaylist"
            target="_blank"
            rel="noreferrer"
          >
            github.com/PraneelBhatia/SharedPlaylist
          </a>
        </span>
      </footer>
    </main>
  );
}
