import type { Provider } from "@sharedplaylist/shared-types";

type LogoProps = {
  size?: number;
  monochrome?: boolean;
  className?: string;
};

export function SpotifyLogo({ size = 24, monochrome = false, className }: LogoProps) {
  const fill = monochrome ? "currentColor" : "#1DB954";
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-label="Spotify"
    >
      <path
        fill={fill}
        d="M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12C24 5.4 18.66 0 12 0Zm5.521 17.34c-.24.359-.66.48-1.021.24-2.82-1.74-6.36-2.101-10.561-1.141-.418.122-.779-.179-.899-.539-.12-.421.18-.78.54-.9 4.56-1.021 8.52-.6 11.64 1.32.42.18.479.659.301 1.02zm1.44-3.3c-.301.42-.841.6-1.262.3-3.239-1.98-8.159-2.58-11.939-1.38-.479.12-1.02-.12-1.14-.6-.12-.48.12-1.021.6-1.141C9.6 9.9 15 10.561 18.72 12.84c.361.181.54.78.241 1.2zm.12-3.36C15.24 8.4 8.82 8.16 5.16 9.301c-.6.179-1.2-.181-1.38-.721-.18-.601.18-1.2.72-1.381 4.26-1.26 11.28-1.02 15.721 1.621.539.3.719 1.02.42 1.56-.299.421-1.02.599-1.56.3z"
      />
    </svg>
  );
}

export function AppleMusicLogo({ size = 24, monochrome = false, className }: LogoProps) {
  const fill = monochrome ? "currentColor" : "url(#applemusic-grad)";
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-label="Apple Music"
    >
      {!monochrome ? (
        <defs>
          <linearGradient id="applemusic-grad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#FA5E5B" />
            <stop offset="100%" stopColor="#FA243C" />
          </linearGradient>
        </defs>
      ) : null}
      <path
        fill={fill}
        d="M23.997 6.124c0-.738-.065-1.47-.24-2.19-.317-1.31-1.062-2.31-2.18-3.043C21.003.517 20.373.285 19.703.143 19.195.034 18.682 0 18.167 0H5.836c-.515 0-1.028.034-1.536.143-.67.142-1.3.374-1.874.748C1.308 1.624.563 2.624.247 3.934.072 4.654.006 5.386.006 6.124v11.749c0 .739.066 1.47.241 2.19.316 1.31 1.061 2.31 2.179 3.043.574.374 1.204.606 1.874.748.508.109 1.021.143 1.536.143h12.331c.515 0 1.028-.034 1.536-.143.67-.142 1.3-.374 1.874-.748 1.118-.733 1.863-1.733 2.179-3.043.175-.72.241-1.451.241-2.19V6.124zm-6.962 1.96-7.13 1.466v8.064c0 1.213-.969 2.196-2.166 2.196-1.197 0-2.166-.983-2.166-2.196 0-1.213.97-2.196 2.166-2.196.31 0 .604.066.87.185V6.823l8.412-1.729a.51.51 0 0 1 .605.5v.49z"
      />
    </svg>
  );
}

export function YouTubeMusicLogo({ size = 24, monochrome = false, className }: LogoProps) {
  const ringFill = monochrome ? "currentColor" : "#FF0000";
  const triangleFill = monochrome ? "currentColor" : "#FFFFFF";
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-label="YouTube Music"
    >
      <circle cx="12" cy="12" r="12" fill={ringFill} />
      <circle cx="12" cy="12" r="7" fill="none" stroke={triangleFill} strokeWidth="1.5" />
      <path d="M10 9 L15 12 L10 15 Z" fill={triangleFill} />
    </svg>
  );
}

export function ProviderLogo({
  provider,
  size = 24,
  monochrome = false,
  className,
}: LogoProps & { provider: Provider }) {
  switch (provider) {
    case "spotify":
      return <SpotifyLogo size={size} monochrome={monochrome} className={className} />;
    case "apple_music":
      return <AppleMusicLogo size={size} monochrome={monochrome} className={className} />;
    case "youtube":
      return <YouTubeMusicLogo size={size} monochrome={monochrome} className={className} />;
  }
}

export const PROVIDER_LABEL: Record<Provider, string> = {
  spotify: "Spotify",
  apple_music: "Apple Music",
  youtube: "YouTube Music",
};

export const PROVIDER_ACCENT: Record<Provider, string> = {
  spotify: "#1DB954",
  apple_music: "#FA243C",
  youtube: "#FF0000",
};
