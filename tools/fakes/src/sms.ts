import type { FastifyInstance } from "fastify";

export interface FakeSms {
  id: string;
  to: string;
  text: string;
  kind: string;
  status: "sent";
  at: string;
}

export function smsRoutes(app: FastifyInstance): void {
  const messages: FakeSms[] = [];
  let seq = 0;

  app.post("/sms/send", async (req, reply) => {
    const b = (req.body ?? {}) as { to?: unknown; text?: unknown; kind?: unknown };
    if (typeof b.to !== "string" || !b.to || typeof b.text !== "string") {
      return reply.code(400).send({ error: "invalid_request" });
    }
    const m: FakeSms = {
      id: `sms-${++seq}`,
      to: b.to,
      text: b.text,
      kind: typeof b.kind === "string" ? b.kind : "otp",
      status: "sent",
      at: new Date().toISOString(),
    };
    messages.push(m);
    return { id: m.id, status: m.status };
  });

  app.get("/sms/messages", async (req) => {
    const { to } = req.query as { to?: string };
    return { messages: to ? messages.filter((m) => m.to === to) : messages };
  });

  app.post("/sms/__reset", async () => {
    messages.length = 0;
    seq = 0;
    return { ok: true };
  });
}
