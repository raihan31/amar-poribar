import websocket from "@fastify/websocket";
import type { FastifyInstance } from "fastify";
import type { Hub } from "./hub.js";
import { MAX_FRAME_BYTES } from "./protocol.js";

/** Registers `GET /v1/ws` and ties the hub's lifetime to the app's. */
export async function realtimePlugin(app: FastifyInstance, opts: { hub: Hub }): Promise<void> {
  const { hub } = opts;
  await app.register(websocket, { options: { maxPayload: MAX_FRAME_BYTES } });
  app.get("/v1/ws", { websocket: true }, (socket) => hub.attach(socket));
  await hub.start();
  app.addHook("onClose", async () => {
    await hub.stop();
  });
}
