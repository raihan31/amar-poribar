import { fileURLToPath } from "node:url";
import Fastify, { type FastifyInstance } from "fastify";
import { fcmRoutes } from "./fcm.js";
import { smsRoutes } from "./sms.js";

/** One small app hosting every fake external service (SMS gateway, FCM). */
export function buildFakes(): FastifyInstance {
  const app = Fastify({ logger: false });
  app.get("/health", async () => ({ ok: true }));
  smsRoutes(app);
  fcmRoutes(app);
  return app;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const port = Number(process.env.FAKES_PORT ?? 4100);
  buildFakes()
    .listen({ port, host: process.env.FAKES_HOST ?? "0.0.0.0" })
    .then(() => console.log(`fakes listening on ${port}`))
    .catch((e) => {
      console.error(e);
      process.exit(1);
    });
}
