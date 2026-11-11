import { UpdateNotificationPreferencesSchema } from "@amar-poribar/shared";
import type { FastifyInstance } from "fastify";
import type { Db } from "../../../platform/db.js";
import { parseOr400 } from "../../../platform/errors.js";
import { docs } from "../../../platform/http/responses.js";
import { readPreferences, updatePreferences } from "../app/preferences.js";

/** `GET` and `PUT /v1/me/notification-preferences` (FR-NOTIF-05). Always scoped to the caller. */
export function preferencesRoutes(app: FastifyInstance, deps: { db: Db }): void {
  app.get("/v1/me/notification-preferences", { preHandler: app.authenticate, schema: docs.object }, async (req) =>
    readPreferences(deps.db, req.user.sub),
  );
  app.put("/v1/me/notification-preferences", { preHandler: app.authenticate, schema: docs.object }, async (req) =>
    updatePreferences(deps.db, req.user.sub, parseOr400(UpdateNotificationPreferencesSchema, req.body)),
  );
}
