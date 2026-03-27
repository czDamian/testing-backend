import "dotenv/config";

function requireEnv(key: string, fallback?: string): string {
  const val = process.env[key] ?? fallback;
  if (!val) throw new Error(`Missing required env var: ${key}`);
  return val;
}

export const settings = {
  appEnv: process.env["APP_ENV"] ?? "development",
  appPort: parseInt(process.env["APP_PORT"] ?? "8000", 10),

  anthropicApiKey: requireEnv("ANTHROPIC_API_KEY"),
  anthropicModel: process.env["ANTHROPIC_MODEL"] ?? "claude-3-5-sonnet-20241022",

  supabaseUrl: requireEnv("SUPABASE_URL"),
  supabaseServiceRoleKey: requireEnv("SUPABASE_SERVICE_ROLE_KEY"),

  sessionTtl: parseInt(process.env["SESSION_TTL"] ?? "1800", 10),
} as const;
