import { readFileSync } from "node:fs";
import { SignJWT, importPKCS8 } from "jose";
import { env } from "../env.ts";

let cached: { token: string; expiresAt: number } | null = null;

/**
 * Generates an Apple Music developer token (ES256 JWT).
 * Tokens are valid for 1 hour (we could go up to 6 months, but short-lived
 * tokens are safer for a smoke test and force us to test the refresh path).
 */
export async function getAppleDeveloperToken(): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  if (cached && cached.expiresAt > now + 60) {
    return cached.token;
  }

  const pem = readFileSync(env.apple.privateKeyPath(), "utf8");
  const privateKey = await importPKCS8(pem, "ES256");

  const expiresAt = now + 60 * 60; // 1 hour
  const token = await new SignJWT({})
    .setProtectedHeader({ alg: "ES256", kid: env.apple.keyId() })
    .setIssuer(env.apple.teamId())
    .setIssuedAt(now)
    .setExpirationTime(expiresAt)
    .sign(privateKey);

  cached = { token, expiresAt };
  return token;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  getAppleDeveloperToken()
    .then((t) => {
      console.log("Apple developer token (use as Authorization: Bearer <token>):");
      console.log(t);
    })
    .catch((err) => {
      console.error("Token generation failed:", err);
      process.exit(1);
    });
}
