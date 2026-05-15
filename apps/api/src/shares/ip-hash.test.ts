import { describe, expect, it } from "vitest";
import { hashIp } from "./ip-hash.ts";

describe("hashIp", () => {
  it("produces a hex string", () => {
    const out = hashIp("203.0.113.7", "salt", new Date("2026-05-14"));
    expect(out).toMatch(/^[0-9a-f]{64}$/);
  });

  it("same ip + same day → same hash", () => {
    const day = new Date("2026-05-14T12:00:00Z");
    expect(hashIp("203.0.113.7", "salt", day)).toEqual(hashIp("203.0.113.7", "salt", day));
  });

  it("same ip + different day → different hash", () => {
    const a = hashIp("203.0.113.7", "salt", new Date("2026-05-14"));
    const b = hashIp("203.0.113.7", "salt", new Date("2026-05-15"));
    expect(a).not.toEqual(b);
  });

  it("returns null when ip is undefined", () => {
    expect(hashIp(undefined, "salt", new Date())).toBeNull();
  });
});
