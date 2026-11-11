import type { FastifyInstance } from "fastify";
import type { FakePushSender } from "../infra/fake-sender.js";

/** Registered only when `PUSH_DRIVER=fake`. Hidden from OpenAPI: test support, not a product API. */
export function testSinkRoutes(app: FastifyInstance, sink: FakePushSender): void {
  app.get("/test/push-sink", { schema: { hide: true } }, async () => sink.messages());
  app.delete("/test/push-sink", { schema: { hide: true } }, async (_req, reply) => {
    sink.clear();
    return reply.code(204).send();
  });
}
