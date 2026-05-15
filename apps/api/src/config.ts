import { z } from "zod";

const envSchema = z.object({
  NODE_ENV: z.string().default("development"),
  API_HOST: z.string().default("127.0.0.1"),
  API_PORT: z.coerce.number().default(4000),
  DATABASE_URL: z.string().min(1),
  REDIS_URL: z.string().min(1),
  TOKEN_ENCRYPTION_KEY: z.string().min(1),
  SPOTIFY_CLIENT_ID: z.string().optional(),
  SPOTIFY_CLIENT_SECRET: z.string().optional(),
  SPOTIFY_REDIRECT_URI: z.string().default("http://127.0.0.1:4000/v1/connections/spotify/callback"),
  APPLE_TEAM_ID: z.string().optional(),
  APPLE_KEY_ID: z.string().optional(),
  APPLE_PRIVATE_KEY_PATH: z.string().optional(),
  APPLE_STOREFRONT: z.string().default("us"),
  GOOGLE_CLIENT_ID: z.string().optional(),
  GOOGLE_CLIENT_SECRET: z.string().optional(),
  GOOGLE_REDIRECT_URI: z.string().default("http://127.0.0.1:4000/v1/connections/youtube/callback"),
  YOUTUBE_BETA_ENABLED: z
    .string()
    .default("false")
    .transform((value) => value === "true"),
  SYNC_ACTIVE_INTERVAL_SECONDS: z.coerce.number().default(30),
  SYNC_IDLE_INTERVAL_SECONDS: z.coerce.number().default(300),
  MAX_SHARE_MEMBERS: z.coerce.number().int().min(2).max(50).default(5),
  INVITE_TTL_DAYS: z.coerce.number().int().min(1).max(90).default(7),
  ADMIN_OWNER_EMAIL: z.string().default(""),
  IP_HASH_SALT: z.string().default("change-me-per-deploy"),
});

export const config = envSchema.parse(process.env);

export function requireConfig(name: keyof typeof config): string {
  const value = config[name];
  if (typeof value !== "string" || value.length === 0) {
    throw new Error(`Missing required config: ${name}`);
  }
  return value;
}
