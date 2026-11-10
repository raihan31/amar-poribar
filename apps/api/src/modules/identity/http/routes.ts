import type { FastifyInstance } from "fastify";
import { authRoutes } from "./auth.routes.js";

/** Identity's HTTP routes. More arrive with T-ID-04..07. */
export function registerIdentityRoutes(app: FastifyInstance, deps: Parameters<typeof authRoutes>[1]): void {
  authRoutes(app, deps);
}
