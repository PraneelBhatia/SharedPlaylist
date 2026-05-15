import { createHash } from "node:crypto";

export function hashIp(ip: string | undefined, salt: string, now: Date): string | null {
  if (!ip) return null;
  const dayKey = now.toISOString().slice(0, 10);
  return createHash("sha256").update(`${ip}|${dayKey}|${salt}`).digest("hex");
}
