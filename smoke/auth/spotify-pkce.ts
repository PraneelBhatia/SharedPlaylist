import { createHash, randomBytes } from "node:crypto";
import { createServer } from "node:http";
import { spawn } from "node:child_process";
import { URL } from "node:url";
import { env } from "../env.ts";
import { setKv, setJson, getJson, STATE_KEYS } from "../state.ts";

type SpotifyTokenResponse = {
  access_token: string;
  token_type: string;
  scope: string;
  expires_in: number;
  refresh_token: string;
};

type StoredTokens = SpotifyTokenResponse & { obtained_at: number };

const SCOPES = [
  "playlist-read-private",
  "playlist-modify-private",
  "playlist-modify-public",
  "user-read-private",
].join(" ");

function base64url(buf: Buffer): string {
  return buf.toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function generateCodeVerifier(): string {
  return base64url(randomBytes(48));
}

function generateCodeChallenge(verifier: string): string {
  return base64url(createHash("sha256").update(verifier).digest());
}

function openBrowser(url: string): void {
  const platform = process.platform;
  const cmd = platform === "darwin" ? "open" : platform === "win32" ? "start" : "xdg-open";
  spawn(cmd, [url], { detached: true, stdio: "ignore" }).unref();
}

async function exchangeCodeForToken(code: string, verifier: string): Promise<SpotifyTokenResponse> {
  const body = new URLSearchParams({
    grant_type: "authorization_code",
    code,
    redirect_uri: env.spotify.redirectUri(),
    client_id: env.spotify.clientId(),
    code_verifier: verifier,
  });
  const res = await fetch("https://accounts.spotify.com/api/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });
  if (!res.ok) {
    throw new Error(`Spotify token exchange failed: ${res.status} ${await res.text()}`);
  }
  return (await res.json()) as SpotifyTokenResponse;
}

export async function refreshSpotifyAccessToken(): Promise<string> {
  const stored = getJson<StoredTokens>(STATE_KEYS.spotifyTokens);
  if (!stored) throw new Error("No Spotify tokens stored. Run `pnpm smoke:auth:spotify` first.");

  const elapsed = (Date.now() - stored.obtained_at) / 1000;
  if (elapsed < stored.expires_in - 60) {
    return stored.access_token;
  }

  const body = new URLSearchParams({
    grant_type: "refresh_token",
    refresh_token: stored.refresh_token,
    client_id: env.spotify.clientId(),
  });
  const res = await fetch("https://accounts.spotify.com/api/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });
  if (!res.ok) {
    throw new Error(`Spotify token refresh failed: ${res.status} ${await res.text()}`);
  }
  const refreshed = (await res.json()) as SpotifyTokenResponse;
  const merged: StoredTokens = {
    ...refreshed,
    refresh_token: refreshed.refresh_token ?? stored.refresh_token,
    obtained_at: Date.now(),
  };
  setJson(STATE_KEYS.spotifyTokens, merged);
  return merged.access_token;
}

async function runOAuthFlow(): Promise<void> {
  const verifier = generateCodeVerifier();
  const challenge = generateCodeChallenge(verifier);
  setKv(STATE_KEYS.spotifyPkceVerifier, verifier);

  const state = base64url(randomBytes(16));
  const authUrl = new URL("https://accounts.spotify.com/authorize");
  authUrl.searchParams.set("client_id", env.spotify.clientId());
  authUrl.searchParams.set("response_type", "code");
  authUrl.searchParams.set("redirect_uri", env.spotify.redirectUri());
  authUrl.searchParams.set("scope", SCOPES);
  authUrl.searchParams.set("code_challenge_method", "S256");
  authUrl.searchParams.set("code_challenge", challenge);
  authUrl.searchParams.set("state", state);

  const port = Number(new URL(env.spotify.redirectUri()).port || 8888);

  await new Promise<void>((resolve, reject) => {
    const server = createServer(async (req, res) => {
      if (!req.url) return;
      const reqUrl = new URL(req.url, `http://127.0.0.1:${port}`);
      if (reqUrl.pathname !== "/callback") {
        res.writeHead(404).end();
        return;
      }

      const code = reqUrl.searchParams.get("code");
      const returnedState = reqUrl.searchParams.get("state");
      const error = reqUrl.searchParams.get("error");

      if (error) {
        res.writeHead(400, { "Content-Type": "text/html" }).end(
          `<h1>Spotify auth failed</h1><p>${error}</p>`,
        );
        server.close();
        reject(new Error(`Spotify auth error: ${error}`));
        return;
      }
      if (!code || returnedState !== state) {
        res.writeHead(400, { "Content-Type": "text/html" }).end(
          "<h1>Spotify auth failed</h1><p>Missing code or state mismatch.</p>",
        );
        server.close();
        reject(new Error("Missing code or state mismatch"));
        return;
      }

      try {
        const tokens = await exchangeCodeForToken(code, verifier);
        const stored: StoredTokens = { ...tokens, obtained_at: Date.now() };
        setJson(STATE_KEYS.spotifyTokens, stored);

        res.writeHead(200, { "Content-Type": "text/html" }).end(`
          <html><body style="font-family: system-ui; padding: 2rem; max-width: 480px;">
            <h1>✓ Spotify connected</h1>
            <p>Token stored. You can close this tab and return to the terminal.</p>
          </body></html>
        `);
        server.close();
        console.log("✓ Spotify tokens captured and stored.");
        resolve();
      } catch (err) {
        res.writeHead(500, { "Content-Type": "text/html" }).end(
          `<h1>Token exchange failed</h1><pre>${(err as Error).message}</pre>`,
        );
        server.close();
        reject(err);
      }
    });

    server.listen(port, "127.0.0.1", () => {
      console.log(`Spotify auth server listening on http://127.0.0.1:${port}`);
      console.log("Opening browser for Spotify authorization...");
      openBrowser(authUrl.toString());
      console.log(`If the browser didn't open, visit:\n${authUrl.toString()}\n`);
    });
  });
}

if (import.meta.url === `file://${process.argv[1]}`) {
  runOAuthFlow().catch((err) => {
    console.error("Auth failed:", err);
    process.exit(1);
  });
}
