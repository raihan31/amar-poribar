import type { FastifyInstance } from "fastify";
import { z } from "zod";

export class HttpError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
  ) {
    super(message);
  }
}

/** Validate with a Zod schema, turning failures into a 400. */
export function parseOr400<T extends z.ZodType>(schema: T, data: unknown): z.infer<T> {
  const result = schema.safeParse(data);
  if (!result.success) throw new HttpError(400, "invalid_request", z.prettifyError(result.error));
  return result.data;
}

export function registerErrorHandler(app: FastifyInstance) {
  app.setErrorHandler((err, req, reply) => {
    if (err instanceof HttpError) {
      return reply.status(err.status).send({ error: { code: err.code, message: err.message } });
    }
    req.log.error(err);
    return reply.status(500).send({ error: { code: "internal", message: "Something went wrong" } });
  });
}
