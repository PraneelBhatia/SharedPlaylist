import { randomBytes } from "node:crypto";

export type MintedInvite = {
  token: string;
  expiresAt: Date;
};

export function mintInviteToken(ttlDays: number): MintedInvite {
  const token = randomBytes(18).toString("base64url");
  const expiresAt = new Date(Date.now() + ttlDays * 24 * 60 * 60 * 1000);
  return { token, expiresAt };
}
