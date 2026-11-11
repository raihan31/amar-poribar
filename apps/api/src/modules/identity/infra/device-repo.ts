import { and, eq } from "drizzle-orm";
import type { Db } from "../../../platform/db.js";
import type { DeviceRemover } from "../app/ports.js";
import { devices } from "../schema.js";

export function createDeviceRemover(db: Db): DeviceRemover {
  return {
    async removeDevice(userId, deviceId) {
      await db.delete(devices).where(and(eq(devices.userId, userId), eq(devices.deviceId, deviceId)));
    },
  };
}
