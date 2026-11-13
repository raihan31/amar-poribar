import type { FastifyInstance, HTTPMethods, RouteHandlerMethod, preHandlerHookHandler } from "fastify";
import type { ZodTypeProvider } from "fastify-type-provider-zod";
import type { z } from "zod";

export interface RouteSchemas {
  params?: z.ZodType;
  querystring?: z.ZodType;
  body?: z.ZodType;
  /** Status code (or "2xx"/"4xx") to schema. Use `ApiErrorSchema` for 4xx/5xx. */
  response?: Record<string | number, z.ZodType>;
  tags?: string[];
  summary?: string;
}

export interface RouteOptions {
  method: HTTPMethods | HTTPMethods[];
  url: string;
  schema: RouteSchemas;
  preHandler?: preHandlerHookHandler | preHandlerHookHandler[];
}

/**
 * Registers a route with Zod schemas so it is validated, serialized and documented in OpenAPI.
 * New and moved routes use this instead of `parseOr400` (SRS §5.3).
 */
export function route(app: FastifyInstance, opts: RouteOptions, handler: RouteHandlerMethod) {
  app.withTypeProvider<ZodTypeProvider>().route({
    method: opts.method,
    url: opts.url,
    schema: opts.schema,
    preHandler: opts.preHandler,
    handler,
  });
}
