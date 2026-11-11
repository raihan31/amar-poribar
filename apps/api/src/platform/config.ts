import { z } from "zod";

/** Treat empty strings (e.g. `${VAR:-}` in Compose) as unset. */
const blank = (v: unknown) => (typeof v === "string" ? (v.trim() === "" ? undefined : v.trim()) : v);
const optStr = () => z.preprocess(blank, z.string().optional());
const withDefault = (d: string) => z.preprocess(blank, z.string().default(d));
const list = () =>
  z.preprocess(blank, z.string().default("")).transform((s) =>
    s
      .split(",")
      .map((o) => o.trim())
      .filter(Boolean),
  );

const PAYMENT_KEYS = [
  "BKASH_APP_KEY",
  "BKASH_APP_SECRET",
  "BKASH_USERNAME",
  "BKASH_PASSWORD",
  "BKASH_BASE_URL",
  "NAGAD_MERCHANT_ID",
  "NAGAD_PUBLIC_KEY",
  "NAGAD_PRIVATE_KEY",
  "NAGAD_BASE_URL",
  "SSLCOMMERZ_STORE_ID",
  "SSLCOMMERZ_STORE_PASSWORD",
  "SSLCOMMERZ_BASE_URL",
] as const;

const paymentShape = Object.fromEntries(PAYMENT_KEYS.map((k) => [k, optStr()])) as Record<
  (typeof PAYMENT_KEYS)[number],
  ReturnType<typeof optStr>
>;

export const ConfigSchema = z.object({
  NODE_ENV: z.preprocess(blank, z.enum(["development", "test", "production"]).default("development")),
  PORT: z.preprocess(blank, z.coerce.number().int().min(0).max(65535).default(4000)),
  WORKER_PORT: z.preprocess(blank, z.coerce.number().int().min(0).max(65535).default(4001)),
  DATABASE_URL: withDefault("postgres://amar:amar@localhost:5432/amar_poribar"),
  DB_POOL_MAX: z.preprocess(blank, z.coerce.number().int().min(1).max(200).default(10)),
  MIGRATE_ON_START: z.preprocess(blank, z.enum(["true", "false"]).default("true")),
  JWT_SECRET: optStr(),
  OTP_PEPPER: optStr(),
  CORS_ORIGIN: list(),
  PUBLIC_WEB_URL: withDefault("http://localhost:3000"),
  ANTHROPIC_API_KEY: optStr(),
  AI_MODEL: optStr(),
  SMS_GATEWAY: z.preprocess(blank, z.enum(["fake", "sslwireless", "alphasms"]).default("fake")),
  SMS_API_KEY: optStr(),
  SMS_SENDER_ID: optStr(),
  FAKES_URL: withDefault("http://localhost:4100"),
  PUSH_PROVIDER: z.preprocess(blank, z.enum(["fake", "fcm"]).default("fake")),
  PUSH_DRIVER: z.preprocess(blank, z.enum(["fcm", "fake"]).optional()),
  FCM_CREDENTIALS_JSON: optStr(),
  FCM_PROJECT_ID: optStr(),
  FCM_SERVICE_ACCOUNT_JSON: optStr(),
  STORAGE_ENDPOINT: withDefault("http://localhost:9000"),
  STORAGE_BUCKET: withDefault("amar"),
  STORAGE_ACCESS_KEY: withDefault("minioadmin"),
  STORAGE_SECRET_KEY: withDefault("minioadmin"),
  STORAGE_REGION: withDefault("us-east-1"),
  TURN_URLS: list(),
  TURN_SECRET: optStr(),
  TURN_TTL_SECONDS: z.preprocess(blank, z.coerce.number().int().positive().default(3600)),
  PAYMENT_PROVIDER: z.preprocess(blank, z.enum(["fake", "real"]).default("fake")),
  OPENAPI_PUBLIC: z.preprocess(blank, z.enum(["true", "false"]).default("false")),
  ...paymentShape,
  ROLE: z.preprocess(blank, z.enum(["api", "worker", "all"]).default("all")),
  LOG_LEVEL: z.preprocess(
    blank,
    z.enum(["fatal", "error", "warn", "info", "debug", "trace", "silent"]).default("info"),
  ),
  METRICS_TOKEN: optStr(),
  FEATURE_FLAGS: list(),
});

/** Cross-field rules run on the raw values so they are reported together with per-field errors. */
function crossChecks(env: Record<string, string | undefined>): z.core.$ZodIssue[] {
  const issues: z.core.$ZodIssue[] = [];
  const issue = (path: string, message: string) =>
    issues.push({ code: "custom", path: [path], message, input: undefined });
  const get = (k: string) => blank(env[k]) as string | undefined;
  if (get("NODE_ENV") === "production") {
    const s = get("JWT_SECRET");
    if (!s || s.length < 32 || /change-?me/i.test(s)) {
      issue("JWT_SECRET", "JWT_SECRET must be a random value of at least 32 characters in production");
    }
    if ((get("OTP_PEPPER") ?? "").length < 32) {
      issue("OTP_PEPPER", "OTP_PEPPER must be a random value of at least 32 characters in production");
    }
    if ((get("SMS_GATEWAY") ?? "fake") === "fake") issue("SMS_GATEWAY", "SMS_GATEWAY must not be fake in production");
  }
  if (get("PUSH_PROVIDER") === "fcm" && !get("FCM_PROJECT_ID"))
    issue("FCM_PROJECT_ID", "required when PUSH_PROVIDER=fcm");
  if (get("PUSH_DRIVER") === "fcm" && !get("FCM_CREDENTIALS_JSON"))
    issue("FCM_CREDENTIALS_JSON", "required (base64 service-account JSON) when PUSH_DRIVER=fcm");
  if (get("PAYMENT_PROVIDER") === "real") {
    for (const k of PAYMENT_KEYS) if (!get(k)) issue(k, "required when PAYMENT_PROVIDER=real");
  }
  for (const f of (get("FEATURE_FLAGS") ?? "")
    .split(",")
    .map((x) => x.trim())
    .filter(Boolean)) {
    if (!/^[^=\s]+=(on|off)$/.test(f)) issue("FEATURE_FLAGS", `invalid entry "${f}", expected flag=on|off`);
  }
  return issues;
}

function build(c: z.output<typeof ConfigSchema>) {
  const featureFlags: Record<string, boolean> = {};
  for (const f of c.FEATURE_FLAGS) {
    const [name, v] = f.split("=");
    if (name) featureFlags[name] = v === "on";
  }
  const payment = Object.fromEntries(
    PAYMENT_KEYS.map((k) => [k.toLowerCase().replace(/_([a-z])/g, (_, ch: string) => ch.toUpperCase()), c[k]]),
  ) as Record<string, string | undefined>;
  return {
    nodeEnv: c.NODE_ENV,
    isProd: c.NODE_ENV === "production",
    port: c.PORT,
    workerPort: c.WORKER_PORT,
    databaseUrl: c.DATABASE_URL,
    dbPoolMax: c.DB_POOL_MAX,
    migrateOnStart: c.MIGRATE_ON_START === "true",
    jwtSecret: c.JWT_SECRET ?? "dev-secret-change-me",
    otpPepper: c.OTP_PEPPER ?? "dev-otp-pepper-change-me-00000000",
    corsOrigins: c.CORS_ORIGIN,
    publicWebUrl: c.PUBLIC_WEB_URL.replace(/\/+$/, ""),
    anthropicApiKey: c.ANTHROPIC_API_KEY,
    aiModel: c.AI_MODEL,
    smsGateway: c.SMS_GATEWAY,
    smsApiKey: c.SMS_API_KEY,
    smsSenderId: c.SMS_SENDER_ID,
    fakesUrl: c.FAKES_URL,
    pushProvider: c.PUSH_PROVIDER,
    pushDriver: c.PUSH_DRIVER ?? (c.NODE_ENV === "production" ? "fcm" : "fake"),
    fcmCredentialsJson: c.FCM_CREDENTIALS_JSON,
    fcmProjectId: c.FCM_PROJECT_ID,
    fcmServiceAccountJson: c.FCM_SERVICE_ACCOUNT_JSON,
    storageEndpoint: c.STORAGE_ENDPOINT,
    storageBucket: c.STORAGE_BUCKET,
    storageAccessKey: c.STORAGE_ACCESS_KEY,
    storageSecretKey: c.STORAGE_SECRET_KEY,
    storageRegion: c.STORAGE_REGION,
    turnUrls: c.TURN_URLS,
    turnSecret: c.TURN_SECRET,
    turnTtlSeconds: c.TURN_TTL_SECONDS,
    paymentProvider: c.PAYMENT_PROVIDER,
    payment,
    role: c.ROLE,
    logLevel: c.LOG_LEVEL,
    metricsToken: c.METRICS_TOKEN,
    openapiPublic: c.OPENAPI_PUBLIC === "true",
    featureFlags,
  };
}

export type Config = Readonly<ReturnType<typeof build>>;

/** Parse and validate environment variables; throws one Error listing every invalid variable. */
export function loadConfig(
  source: Record<string, string | undefined> = process.env,
  overrides: Record<string, string | undefined> = {},
): Config {
  const env = { ...source, ...overrides };
  const parsed = ConfigSchema.safeParse(env);
  const issues = [...(parsed.success ? [] : parsed.error.issues), ...crossChecks(env)];
  if (!parsed.success || issues.length > 0) {
    throw new Error(`Invalid configuration:\n${z.prettifyError(new z.ZodError(issues))}`);
  }
  return Object.freeze(build(parsed.data));
}
