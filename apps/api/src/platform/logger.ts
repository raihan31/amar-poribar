import { randomUUID } from "node:crypto";
import type { FastifyBaseLogger, FastifyInstance } from "fastify";
import pino, { type LoggerOptions } from "pino";
import { getContext, runWithContext, setContext } from "./request-context.js";

export const REDACT_PATHS = [
  "req.headers.authorization",
  "req.headers.cookie",
  "*.token",
  "*.refreshToken",
  "*.accessToken",
  "*.code",
  "*.phone",
  "*.body",
  "*.fcmToken",
  "*.password",
  "*.totp",
];

const PHONE = /(?:\+?8801|01)\d{9}/g;
const REQUEST_ID = /^[A-Za-z0-9-]{8,64}$/;

/** Replaces Bangladeshi mobile numbers with `•••` plus the last 3 digits. */
export function maskPhones(s: string): string {
  return s.replace(PHONE, (m) => `•••${m.slice(-3)}`);
}

function maskDeep(v: unknown, depth = 0): unknown {
  if (typeof v === "string") return maskPhones(v);
  if (depth > 5 || v === null || typeof v !== "object") return v;
  if (Array.isArray(v)) return v.map((x) => maskDeep(x, depth + 1));
  if (Object.getPrototypeOf(v) !== Object.prototype) return v;
  const out: Record<string, unknown> = {};
  for (const [k, val] of Object.entries(v)) out[k] = maskDeep(val, depth + 1);
  return out;
}

export function createLoggerOptions(config: { level: string }): LoggerOptions {
  return {
    level: config.level,
    redact: { paths: REDACT_PATHS, censor: "[redacted]" },
    formatters: {
      log: (obj) => maskDeep(obj) as Record<string, unknown>,
    },
    hooks: {
      logMethod(args, method) {
        const i = typeof args[0] === "string" ? 0 : 1;
        if (typeof args[i] === "string") args[i] = maskPhones(args[i]);
        return method.apply(this, args);
      },
    },
    mixin() {
      const c = getContext();
      if (!c) return {};
      return {
        reqId: c.requestId,
        ...(c.userId ? { userId: c.userId } : {}),
        ...(c.familyId ? { familyId: c.familyId } : {}),
      };
    },
  };
}

/** Fastify options for request ids. Incoming ids are validated here, so Fastify's own header option stays off. */
export const requestOptions = {
  disableRequestLogging: true,
  genReqId(req: { headers: Record<string, string | string[] | undefined> }): string {
    const h = req.headers["x-request-id"];
    return typeof h === "string" && REQUEST_ID.test(h) ? h : randomUUID(); // uuidv7 once T-PLAT-08 lands
  },
};

/** Hooks: request context, `x-request-id` echo, familyId capture and one access line per request. */
export function installRequestContext(app: FastifyInstance): void {
  app.addHook("onRequest", (req, reply, done) => {
    reply.header("x-request-id", req.id);
    runWithContext({ requestId: req.id }, done);
  });
  app.addHook("preValidation", (req, _reply, done) => {
    const familyId = (req.params as { familyId?: unknown } | undefined)?.familyId;
    if (typeof familyId === "string") setContext({ familyId });
    done();
  });
  app.addHook("onResponse", (req, reply, done) => {
    req.log.info(
      {
        method: req.method,
        route: req.routeOptions?.url ?? "(unmatched)",
        status: reply.statusCode,
        ms: Math.round(reply.elapsedTime),
      },
      "request completed",
    );
    done();
  });
}

/** Builds the pino instance handed to Fastify as `loggerInstance`. */
export function createLogger(config: { level: string }, stream?: NodeJS.WritableStream): FastifyBaseLogger {
  return stream ? pino(createLoggerOptions(config), stream) : pino(createLoggerOptions(config));
}
