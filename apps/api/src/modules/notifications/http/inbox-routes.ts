import {
  InboxChangesQuerySchema,
  InboxChangesSchema,
  InboxListQuerySchema,
  InboxListSchema,
  InboxMarkReadSchema,
} from "@amar-poribar/shared";
import type { FastifyInstance } from "fastify";
import { z } from "zod";
import type { Db } from "../../../platform/db.js";
import { parseOr400 } from "../../../platform/errors.js";
import { docs } from "../../../platform/http/responses.js";
import { clearInbox, deleteInboxItem, inboxChanges, listInbox, markInboxRead } from "../app/inbox.js";

/** Inbox routes (FR-NOTIF-04, FR-NOTIF-08). Every query is scoped to the caller. */
export function inboxRoutes(app: FastifyInstance, deps: { db: Db; clock: () => Date }): void {
  const auth = { preHandler: app.authenticate };
  app.get("/v1/inbox", { ...auth, schema: { response: { "2xx": InboxListSchema } } }, async (req) => {
    const q = parseOr400(InboxListQuerySchema, req.query);
    return listInbox(deps.db, req.user.sub, q.cursor, q.limit);
  });
  app.get("/v1/inbox/changes", { ...auth, schema: { response: { "2xx": InboxChangesSchema } } }, async (req) => {
    const q = parseOr400(InboxChangesQuerySchema, req.query);
    return inboxChanges(deps.db, req.user.sub, q.afterSeq, q.limit);
  });
  app.post("/v1/inbox/read", { ...auth, schema: docs.object }, async (req) =>
    markInboxRead(deps.db, req.user.sub, parseOr400(InboxMarkReadSchema, req.body), deps.clock()),
  );
  app.delete("/v1/inbox", { ...auth, schema: docs.noContent }, async (req, reply) => {
    await clearInbox(deps.db, req.user.sub);
    return reply.status(204).send();
  });
  app.delete("/v1/inbox/:id", { ...auth, schema: docs.noContent }, async (req, reply) => {
    const { id } = parseOr400(z.object({ id: z.string().uuid() }), req.params);
    await deleteInboxItem(deps.db, req.user.sub, id);
    return reply.status(204).send();
  });
}
