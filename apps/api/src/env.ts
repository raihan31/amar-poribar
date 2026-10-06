function required(name: string, fallback?: string): string {
  const value = process.env[name] ?? fallback;
  if (value === undefined) throw new Error(`Missing env var ${name}`);
  return value;
}

export const env = {
  port: Number(process.env.PORT ?? 4000),
  databaseUrl: required("DATABASE_URL", "postgres://amar:amar@localhost:5432/amar_poribar"),
  jwtSecret: required("JWT_SECRET", process.env.NODE_ENV === "production" ? undefined : "dev-secret-change-me"),
  anthropicApiKey: process.env.ANTHROPIC_API_KEY || undefined,
  aiModel: process.env.AI_MODEL || undefined,
  isProd: process.env.NODE_ENV === "production",
};
