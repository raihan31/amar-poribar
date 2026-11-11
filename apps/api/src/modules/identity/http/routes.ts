import type { FastifyInstance } from "fastify";
import { authRoutes } from "./auth-routes.js";
import { logoutRoutes } from "./logout-routes.js";
import { meRoutes } from "./me-routes.js";

/** Identity's HTTP routes. More arrive with T-ID-04..08. */
export function registerIdentityRoutes(
  app: FastifyInstance,
  deps: Parameters<typeof authRoutes>[1] & Parameters<typeof logoutRoutes>[1],
): void {
  authRoutes(app, deps);
  meRoutes(app, deps);
  logoutRoutes(app, deps);
}
