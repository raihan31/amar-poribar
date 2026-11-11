import type { FastifyInstance } from "fastify";
import { docs } from "../../../platform/http/responses.js";
import { registerDevice, unregisterDevice } from "../app/devices.js";
import type { DeviceRepo } from "../infra/device-repo.js";

/** `PUT|DELETE /v1/me/devices/:deviceId` (FR-AUTH-11). */
export function deviceRoutes(app: FastifyInstance, deps: { devices: DeviceRepo; clock: () => Date }): void {
  app.put("/v1/me/devices/:deviceId", { preHandler: app.authenticate, schema: docs.object }, async (req) => {
    const { deviceId } = req.params as { deviceId: string };
    return registerDevice(deps.devices, deps.clock, req.user.sub, deviceId, req.body);
  });
  app.delete(
    "/v1/me/devices/:deviceId",
    { preHandler: app.authenticate, schema: docs.noContent },
    async (req, reply) => {
      const { deviceId } = req.params as { deviceId: string };
      await unregisterDevice(deps.devices, req.user.sub, deviceId);
      return reply.code(204).send(null);
    },
  );
}
