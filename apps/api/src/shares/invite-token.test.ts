import { describe, expect, it } from "vitest";
import { mintInviteToken } from "./invite-token.ts";

describe("mintInviteToken", () => {
  it("returns a URL-safe token at least 16 chars long", () => {
    const { token } = mintInviteToken(7);
    expect(token).toMatch(/^[A-Za-z0-9_-]+$/);
    expect(token.length).toBeGreaterThanOrEqual(16);
  });

  it("returns a future expiry roughly ttlDays from now", () => {
    const before = Date.now();
    const { expiresAt } = mintInviteToken(7);
    const after = Date.now();
    const sevenDaysMs = 7 * 24 * 60 * 60 * 1000;
    expect(expiresAt.getTime()).toBeGreaterThanOrEqual(before + sevenDaysMs - 1000);
    expect(expiresAt.getTime()).toBeLessThanOrEqual(after + sevenDaysMs + 1000);
  });

  it("generates unique tokens across calls", () => {
    const a = mintInviteToken(7);
    const b = mintInviteToken(7);
    expect(a.token).not.toEqual(b.token);
  });
});
