import { describe, expect, it, vi } from "vitest";

describe("token vault", () => {
  it("encrypts and decrypts a token", async () => {
    vi.stubEnv("DATABASE_URL", "postgresql://user:pass@localhost:5432/db");
    vi.stubEnv("REDIS_URL", "redis://localhost:6379");
    vi.stubEnv("TOKEN_ENCRYPTION_KEY", Buffer.alloc(32, 1).toString("base64"));

    const { decryptToken, encryptToken } = await import("./token-vault.ts");
    const encrypted = encryptToken("secret-token");

    expect(encrypted).not.toBe("secret-token");
    expect(decryptToken(encrypted)).toBe("secret-token");
  });
});
