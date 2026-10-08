/** Read an env var, treating empty strings (e.g. `${VAR:-}` in Compose) as unset. */
function optional(name: string): string | undefined {
  const value = process.env[name]?.trim();
  return value ? value : undefined;
}

function required(name: string, fallback?: string): string {
  const value = optional(name) ?? fallback;
  if (value === undefined) throw new Error(`Missing env var ${name}`);
  return value;
}

const isProd = process.env.NODE_ENV === "production";

/** Production refuses to start with a missing, short or placeholder secret, since anyone knowing it can forge tokens. */
function jwtSecret(): string {
  const value = optional("JWT_SECRET");
  if (!isProd) return value ?? "dev-secret-change-me";
  if (!value || value.length < 32 || /change-?me/i.test(value)) {
    throw new Error("JWT_SECRET must be a random value of at least 32 characters in production");
  }
  return value;
}

export const env = {
  port: Number(process.env.PORT ?? 4000),
  databaseUrl: required("DATABASE_URL", "postgres://amar:amar@localhost:5432/amar_poribar"),
  jwtSecret: jwtSecret(),
  anthropicApiKey: optional("ANTHROPIC_API_KEY"),
  aiModel: optional("AI_MODEL"),
  /** Comma-separated browser origins allowed to call the API in production, e.g. the web app's URL. */
  corsOrigins: (optional("CORS_ORIGIN") ?? "").split(",").map((o) => o.trim()).filter(Boolean),
  isProd,
};
