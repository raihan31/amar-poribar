import { and, eq, inArray, isNotNull, lt, sql } from "drizzle-orm";
import type { Db } from "../../../platform/db.js";
import type { DeviceRemover } from "../app/ports.js";
import { devices } from "../schema.js";

export interface DeviceInput {
  platform: "android" | "ios" | "web";
  fcmToken?: string | undefined;
  appVersion: string;
  locale: string;
}

export interface DeviceToken {
  userId: string;
  deviceId: string;
  platform: string;
  token: string;
}

export interface DeviceRepo {
  upsert(userId: string, deviceId: string, input: DeviceInput, now: Date): Promise<void>;
  remove(userId: string, deviceId: string): Promise<void>;
  listTokens(userIds: readonly string[]): Promise<DeviceToken[]>;
  removeToken(token: string): Promise<void>;
  touch(userId: string, deviceId: string, now: Date): Promise<void>;
  purgeSeenBefore(cutoff: Date): Promise<number>;
}

export function createDeviceRepo(db: Db): DeviceRepo {
  return {
    async upsert(userId, deviceId, input, now) {
      const token = input.fcmToken ?? null;
      await db.transaction(async (tx) => {
        // A token belongs to one install: clear it from any other row (a phone sold to someone else).
        if (token !== null) {
          await tx
            .update(devices)
            .set({ fcmToken: null })
            .where(
              and(
                eq(devices.fcmToken, token),
                sql`not (${devices.userId} = ${userId} and ${devices.deviceId} = ${deviceId})`,
              ),
            );
        }
        const values = {
          platform: input.platform,
          fcmToken: token,
          appVersion: input.appVersion,
          locale: input.locale,
          lastSeenAt: now,
        };
        await tx
          .insert(devices)
          .values({ userId, deviceId, ...values, createdAt: now })
          .onConflictDoUpdate({ target: [devices.userId, devices.deviceId], set: values });
      });
    },
    async remove(userId, deviceId) {
      await db.delete(devices).where(and(eq(devices.userId, userId), eq(devices.deviceId, deviceId)));
    },
    async listTokens(userIds) {
      if (userIds.length === 0) return [];
      const rows = await db
        .select({
          userId: devices.userId,
          deviceId: devices.deviceId,
          platform: devices.platform,
          token: devices.fcmToken,
        })
        .from(devices)
        .where(and(inArray(devices.userId, [...userIds]), isNotNull(devices.fcmToken)));
      return rows.map((r) => ({ ...r, token: r.token as string }));
    },
    async removeToken(token) {
      await db.update(devices).set({ fcmToken: null }).where(eq(devices.fcmToken, token));
    },
    async touch(userId, deviceId, now) {
      await db
        .update(devices)
        .set({ lastSeenAt: now })
        .where(and(eq(devices.userId, userId), eq(devices.deviceId, deviceId)));
    },
    async purgeSeenBefore(cutoff) {
      const rows = await db.delete(devices).where(lt(devices.lastSeenAt, cutoff)).returning({ id: devices.deviceId });
      return rows.length;
    },
  };
}

/** Narrow adapter for logout (T-ID-06): removes one device row. */
export function createDeviceRemover(db: Db): DeviceRemover {
  return {
    async removeDevice(userId, deviceId) {
      await db.delete(devices).where(and(eq(devices.userId, userId), eq(devices.deviceId, deviceId)));
    },
  };
}
