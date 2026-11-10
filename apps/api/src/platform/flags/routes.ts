import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { route } from "../http/route.js";
import type { Flags } from "./flags.js";

/** `GET /v1/flags` (no auth): which features are on. */
export function registerFlagRoutes(app: FastifyInstance, flags: Flags): void {
  route(
    app,
    {
      method: "GET",
      url: "/v1/flags",
      schema: {
        tags: ["platform"],
        summary: "Feature flags",
        response: { 200: z.object({ flags: z.record(z.string(), z.boolean()) }) },
      },
    },
    async (_req, reply) => {
      reply.header("Cache-Control", "max-age=60");
      return { flags: await flags.all() };
    },
  );
}
