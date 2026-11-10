import type { FastifyInstance } from "fastify";

export interface FakeFcm {
  name: string;
  project: string;
  token: string;
  message: Record<string, unknown>;
  at: string;
}

export function fcmRoutes(app: FastifyInstance): void {
  const messages: FakeFcm[] = [];
  let seq = 0;

  app.post("/fcm/v1/projects/:p/messages:send", async (req, reply) => {
    const { p } = req.params as { p: string };
    const message = ((req.body ?? {}) as { message?: Record<string, unknown> }).message;
    const token = message?.token;
    if (!message || typeof token !== "string" || !token) {
      return reply
        .code(400)
        .send({ error: { code: 400, status: "INVALID_ARGUMENT", message: "message.token is required" } });
    }
    if (token.startsWith("dead-")) {
      return reply.code(404).send({
        error: {
          code: 404,
          status: "NOT_FOUND",
          message: "Requested entity was not found.",
          details: [
            {
              "@type": "type.googleapis.com/google.firebase.fcm.v1.FcmError",
              errorCode: "UNREGISTERED",
            },
          ],
        },
      });
    }
    const name = `projects/${p}/messages/${++seq}`;
    messages.push({ name, project: p, token, message, at: new Date().toISOString() });
    return { name };
  });

  app.get("/fcm/messages", async (req) => {
    const { token } = req.query as { token?: string };
    return { messages: token ? messages.filter((m) => m.token === token) : messages };
  });

  app.post("/fcm/__reset", async () => {
    messages.length = 0;
    seq = 0;
    return { ok: true };
  });
}
