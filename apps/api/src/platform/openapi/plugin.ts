import swagger from "@fastify/swagger";
import type { FastifyInstance } from "fastify";
import { jsonSchemaTransform } from "fastify-type-provider-zod";

/** Routes that do not need a bearer token (SRS §5.1). Everything else documents `bearerAuth`. */
export const PUBLIC_ROUTE_PATTERNS: readonly RegExp[] = [
  /^\/health$/,
  /^\/ready$/,
  /^\/metrics$/,
  /^\/v1\/openapi\.json$/,
  /^\/v1\/auth\//,
  /^\/v1\/flags(\/|$)/,
  /^\/v1\/invites\/[^/]+\/preview$/,
  /^\/v1\/webhooks\//,
];

export const isPublicRoute = (url: string) => PUBLIC_ROUTE_PATTERNS.some((p) => p.test(url));

export interface OpenApiOptions {
  version: string;
  /** Serve `/v1/openapi.json` (dev/test, or production with OPENAPI_PUBLIC=true). */
  expose: boolean;
}

declare module "fastify" {
  interface FastifyInstance {
    /** Every `METHOD /url` registered after OpenAPI setup (used by the drift tests). */
    registeredRoutes: string[];
  }
}

type RouteSchema = Record<string, unknown> | undefined;

/**
 * Registers `@fastify/swagger` (OpenAPI 3.1). Must run before any route is registered, because
 * swagger collects routes through an `onRoute` hook.
 */
export async function registerOpenApi(app: FastifyInstance, opts: OpenApiOptions) {
  const registered: string[] = [];
  app.decorate("registeredRoutes", registered);
  app.addHook("onRoute", (r) => {
    for (const m of ([] as string[]).concat(r.method)) registered.push(`${m} ${r.url}`);
  });
  await app.register(swagger, {
    openapi: {
      openapi: "3.1.0",
      info: { title: "Amar Poribar API", version: opts.version },
      components: { securitySchemes: { bearerAuth: { type: "http", scheme: "bearer", bearerFormat: "JWT" } } },
    },
    transform: (input) => {
      const schema = input.schema as RouteSchema;
      const documented = !!schema && !!schema.response;
      const base = { ...(schema ?? {}) } as Record<string, unknown>;
      if (!isPublicRoute(input.url)) base.security = [{ bearerAuth: [] }];
      if (!documented) base["x-undocumented"] = true;
      return jsonSchemaTransform({ ...input, schema: base });
    },
  });
  if (opts.expose) {
    app.get("/v1/openapi.json", { schema: { hide: true } }, async () => app.swagger());
  }
}
