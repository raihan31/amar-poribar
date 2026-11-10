import { fileURLToPath } from "node:url";
import Fastify, { type FastifyInstance } from "fastify";
import { claudeRoutes } from "./claude.js";
import { fcmRoutes } from "./fcm.js";
import { paymentRoutes } from "./payments.js";
import { smsRoutes } from "./sms.js";

/** One small app hosting every fake external service (SMS gateway, FCM). */
export function buildFakes(): FastifyInstance {
  const app = Fastify({ logger: false });
  app.get("/health", async () => ({ ok: true }));
  smsRoutes(app);
  fcmRoutes(app);
  paymentRoutes(app);
  claudeRoutes(app);
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
