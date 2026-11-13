import type { FastifyInstance } from "fastify";
import type { Db } from "../../../platform/db.js";
import { docs } from "../../../platform/http/responses.js";
import { getPlanCatalogue } from "../app/catalogue.js";

/** `GET /v1/plans`: the catalogue, for any signed-in user (FR-BILL-01). */
export function planRoutes(app: FastifyInstance, deps: { db: Db }): void {
  app.get("/v1/plans", { preHandler: app.authenticate, schema: docs.object }, async () => ({
    items: await getPlanCatalogue(deps.db),
  }));
}
