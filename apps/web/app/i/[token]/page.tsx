import Link from "next/link";
import type { Provider, SharePreviewDto } from "@sharedplaylist/shared-types";
import { ApiError, apiBase, sharesApi } from "../../_lib/api-client";

export const dynamic = "force-dynamic";

const PROVIDERS: readonly Provider[] = ["spotify", "apple_music", "youtube"] as const;

const PROVIDER_LABEL: Record<Provider, string> = {
  spotify: "Spotify",
  apple_music: "Apple Music",
  youtube: "YouTube",
};

type PreviewResult =
  | { kind: "ok"; preview: SharePreviewDto }
  | { kind: "full"; memberCap: number }
  | { kind: "dead" };

async function loadPreview(token: string): Promise<PreviewResult> {
  try {
    const preview = await sharesApi.preview(token);
    return { kind: "ok", preview };
  } catch (err) {
    if (err instanceof ApiError) {
      if (err.status === 409) {
        const memberCap = parseMemberCapFromBody(err.bodyText);
        return { kind: "full", memberCap };
      }
      if (err.status === 410) {
        return { kind: "dead" };
      }
      console.error("[invite-landing] preview failed", err.status, err.path);
      return { kind: "dead" };
    }
    console.error("[invite-landing] preview failed (network)", err);
    return { kind: "dead" };
  }
}

function parseMemberCapFromBody(bodyText: string): number {
  try {
    const parsed: unknown = JSON.parse(bodyText);
    if (
      parsed &&
      typeof parsed === "object" &&
      "memberCap" in parsed &&
      typeof (parsed as { memberCap: unknown }).memberCap === "number"
    ) {
      return (parsed as { memberCap: number }).memberCap;
    }
  } catch {
    // fall through to default
  }
  return 5;
}

export default async function InviteLandingPage({
  params,
}: {
  params: Promise<{ token: string }>;
}): Promise<React.JSX.Element> {
  const { token } = await params;
  const result = await loadPreview(token);

  if (result.kind === "ok") {
    return <ValidInvite token={token} preview={result.preview} />;
  }
  if (result.kind === "full") {
    return <UnavailableInvite variant="full" memberCap={result.memberCap} />;
  }
  return <UnavailableInvite variant="dead" />;
}

function ValidInvite({
  token,
  preview,
}: {
  token: string;
  preview: SharePreviewDto;
}): React.JSX.Element {
  const sender = preview.creatorDisplayName ?? "Someone";
  const providerLabel = PROVIDER_LABEL[preview.sourceProvider];
  const returnTo = `/i/${token}/accept`;

  return (
    <main className="shell">
      <section className="invite-page" aria-label="You've been invited">
        <span className="invite-page-eyebrow">You&apos;ve been invited</span>
        <h1 className="invite-page-title">
          {sender} wants to share{" "}
          <em>&laquo;{preview.sourcePlaylistName}&raquo;</em> from {providerLabel}
        </h1>
        <p className="invite-page-subtitle">
          {preview.memberCount} of {preview.memberCap} people joined
        </p>

        <div className="invite-page-continue">
          <span className="invite-page-continue-label">Continue with</span>
          <div className="invite-page-providers" role="group" aria-label="Streaming service">
            {PROVIDERS.map((p) => (
              <a
                key={p}
                className="invite-page-provider-btn"
                href={`${apiBase}/v1/connections/${p}/start?returnTo=${encodeURIComponent(returnTo)}`}
              >
                {PROVIDER_LABEL[p]}
              </a>
            ))}
          </div>
        </div>

        <p className="invite-page-footnote">
          By continuing, you agree to share track additions and removals with the other
          people in this playlist.
        </p>
      </section>
    </main>
  );
}

function UnavailableInvite({
  variant,
  memberCap,
}: {
  variant: "full" | "dead";
  memberCap?: number;
}): React.JSX.Element {
  const title =
    variant === "full" ? "This share is full." : "This invite has expired or been revoked.";
  const subtitle =
    variant === "full"
      ? `It's already reached the maximum of ${memberCap ?? 5} people. Ask the sender if they can free up a spot.`
      : "Ask the sender to share a new link.";

  return (
    <main className="shell">
      <section className="invite-page invite-page-unavailable" aria-label="Invite unavailable">
        <span className="invite-page-eyebrow">Invite unavailable</span>
        <h1 className="invite-page-title invite-page-title-muted">{title}</h1>
        <p className="invite-page-subtitle">{subtitle}</p>
        <Link href="/" className="invite-page-back">
          Back to home
        </Link>
      </section>
    </main>
  );
}
