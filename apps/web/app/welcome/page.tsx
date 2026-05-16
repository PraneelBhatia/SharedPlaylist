import Link from "next/link";
import {
  SpotifyLogo,
  AppleMusicLogo,
  YouTubeMusicLogo,
} from "../_components/provider-logos";

export const dynamic = "force-dynamic";

export default function WelcomePage(): React.JSX.Element {
  return (
    <main className="shell welcome">
      <header className="welcome-mast">
        <span className="welcome-eyebrow">You&apos;re in</span>
        <h1 className="welcome-title">
          Welcome to <em>Sharedplaylist</em>.
        </h1>
        <p className="welcome-lede">
          Your music account is connected. Here&apos;s what happens next.
        </p>
      </header>

      <ol className="welcome-steps">
        <li className="welcome-step">
          <div className="welcome-step-num">01</div>
          <div className="welcome-step-body">
            <h2>Pick a playlist to share</h2>
            <p>
              We&apos;ll fetch your playlists from whichever service you just
              connected. Choose the one you want to keep in sync.
            </p>
          </div>
        </li>
        <li className="welcome-step">
          <div className="welcome-step-num">02</div>
          <div className="welcome-step-body">
            <h2>Get a private invite link</h2>
            <p>
              We mint a single 7-day link. Send it to up to four other people —
              text, email, AirDrop, whatever you like.
            </p>
          </div>
        </li>
        <li className="welcome-step">
          <div className="welcome-step-num">03</div>
          <div className="welcome-step-body">
            <h2>They join from any music app</h2>
            <p>
              Whoever opens the link picks their own service. We create a
              matching playlist on their side, then keep both in sync — adds
              and removes — within ~30 seconds.
            </p>
            <div className="welcome-providers">
              <SpotifyLogo size={22} />
              <AppleMusicLogo size={22} />
              <YouTubeMusicLogo size={22} />
            </div>
          </div>
        </li>
      </ol>

      <div className="welcome-cta-row">
        <Link href="/share/new" className="welcome-cta-primary">
          Share my first playlist →
        </Link>
        <Link href="/dashboard" className="welcome-cta-secondary">
          Or open the dashboard
        </Link>
      </div>

      <p className="welcome-trust">
        Heads up: anyone in the share can add or remove tracks, and changes
        propagate to everyone&apos;s playlist on their service. You can leave
        any share at any time — your playlist stays intact on your end.
      </p>
    </main>
  );
}
