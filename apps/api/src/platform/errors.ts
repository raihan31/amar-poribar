/**
 * Error model. Every error response is `{ error: { code, message, details? } }`.
 *
 * Status -> code:
 *  400 invalid_request | 401 unauthorized | 403 forbidden | 404 not_found
 *  409 duplicate / duplicate_trx_id / id_taken | 413 payload_too_large
 *  423 family_suspended
 *  429 rate_limited / ai_quota / nudge_rate_limited / otp_rate_limited
 *  500 internal
 */
import type { FastifyInstance } from "fastify";
import { z } from "zod";

export class HttpError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
    public readonly details?: Record<string, unknown>,
    public readonly headers?: Record<string, string>,
  ) {
    super(message);
  }
}

export const notFound = (msg: string) => new HttpError(404, "not_found", msg);
export const forbidden = (msg: string) => new HttpError(403, "forbidden", msg);
export const conflict = (code: string, msg: string) => new HttpError(409, code, msg);
export const tooManyRequests = (code: string, retryAfterSeconds: number) =>
  new HttpError(429, code, "Too many requests", { retryAfterSeconds }, { "Retry-After": String(retryAfterSeconds) });

/** Validate with a Zod schema, turning failures into a 400. */
export function parseOr400<T extends z.ZodType>(schema: T, data: unknown): z.infer<T> {
  const result = schema.safeParse(data);
  if (!result.success) throw new HttpError(400, "invalid_request", z.prettifyError(result.error));
  return result.data;
}

type FastifyLikeError = Error & { code?: string; validation?: unknown; statusCode?: number };

export function registerErrorHandler(app: FastifyInstance) {
  app.setErrorHandler((err: FastifyLikeError, req, reply) => {
    if (err instanceof HttpError) {
      if (err.headers) reply.headers(err.headers);
      const error: Record<string, unknown> = { code: err.code, message: err.message };
      if (err.details) error.details = err.details;
      return reply.status(err.status).send({ error });
    }
    if (err.code === "FST_ERR_CTP_BODY_TOO_LARGE" || err.statusCode === 413) {
      return reply.status(413).send({ error: { code: "payload_too_large", message: "Payload too large" } });
    }
    if (err.validation || (err.code?.startsWith("FST_ERR_") && err.statusCode === 400)) {
      return reply.status(400).send({ error: { code: "invalid_request", message: err.message } });
    }
    req.log.error(err);
    return reply
      .status(500)
      .send({ error: { code: "internal", message: "Something went wrong", details: { requestId: req.id } } });
  });
}
