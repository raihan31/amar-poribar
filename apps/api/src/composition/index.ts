import type { FastifyInstance } from "fastify";
import type { ModuleContext } from "../platform/module.js";
import { meRoutes } from "./me.routes.js";

/**
 * Routes that join several modules. This is the only layer besides `app.ts` allowed to use more than one
 * facade (SRS R8); it registers after every module.
 */
export function registerComposition(app: FastifyInstance, ctx: ModuleContext) {
  meRoutes(app, ctx);
}
