import { z } from "zod";
import { parseOr400 } from "../../../platform/errors.js";
import type { DeviceInput, DeviceRepo } from "../infra/device-repo.js";

export const DeviceIdSchema = z.string().min(1).max(200);

export const RegisterDeviceSchema = z.object({
  platform: z.enum(["android", "ios", "web"]),
  fcmToken: z.string().min(1).max(4096).optional(),
  appVersion: z.string().min(1).max(50),
  locale: z.string().min(1).max(20),
});

export async function registerDevice(
  repo: DeviceRepo,
  clock: () => Date,
  userId: string,
  deviceId: string,
  body: unknown,
): Promise<{ deviceId: string }> {
  const id = parseOr400(DeviceIdSchema, deviceId);
  const input: DeviceInput = parseOr400(RegisterDeviceSchema, body);
  await repo.upsert(userId, id, input, clock());
  return { deviceId: id };
}

export function unregisterDevice(repo: DeviceRepo, userId: string, deviceId: string): Promise<void> {
  return repo.remove(userId, deviceId);
}
