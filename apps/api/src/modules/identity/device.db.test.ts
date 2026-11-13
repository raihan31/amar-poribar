import { MemorySms } from "../../platform/ports/fakes/memory-sms.js";
import Fastify from "fastify";
import { describe, expect, it } from "vitest";
import { buildTestApp, type Tokens } from "../../../tests/support/app-test.js";
import { testConfig } from "../../../tests/support/config.js";
import { withTestDb } from "../../../tests/support/db-test.js";
import { createJobs } from "../../platform/jobs/jobs.js";
import type { ModuleContext } from "../../platform/module.js";
import { MemoryLimiter } from "../../platform/rate-limit/limiter.js";
import { identityModule } from "./index.js";
import { purgeDevicesJob } from "./jobs.js";

type T = Awaited<ReturnType<typeof buildTestApp>>;
const put = (t: T, tokens: Tokens, id: string, payload: object) =>
  t.app.inject({ method: "PUT", url: `/v1/me/devices/${id}`, headers: t.as(tokens), payload });
const body = (over: object = {}) => ({
  platform: "android",
  fcmToken: "tok-1",
  appVersion: "1.0.0",
  locale: "bn",
  ...over,
});

describe("device registry (db)", () => {
  it("register stores token and platform", async () => {
    await withTestDb(async ({ db, sql }) => {
      const t = await buildTestApp({ db, sql });
      const u = await t.login("01712345678");
      const res = await put(t, u, "dev-1", body());
      expect(res.statusCode).toBe(200);
      const rows = await sql`select platform, fcm_token, app_version, locale from identity.devices`;
      expect(rows).toHaveLength(1);
      expect(rows[0]).toMatchObject({ platform: "android", fcm_token: "tok-1", app_version: "1.0.0", locale: "bn" });
      // upsert, not duplicate
      await put(t, u, "dev-1", body({ fcmToken: "tok-2" }));
      const again = await sql`select fcm_token from identity.devices`;
      expect(again).toHaveLength(1);
      expect(again[0]!.fcm_token).toBe("tok-2");
      expect((await put(t, u, "dev-2", body({ platform: "windows" }))).statusCode).toBe(400);
      await t.close();
    });
  });

  it("same token on a second user moves ownership", async () => {
    await withTestDb(async ({ db, sql }) => {
      const t = await buildTestApp({ db, sql });
      const a = await t.login("01712345678");
      const b = await t.login("01812345678");
      await put(t, a, "dev-a", body());
      await put(t, b, "dev-b", body());
      const rows = await sql`select device_id, fcm_token from identity.devices order by device_id`;
      expect(rows).toHaveLength(2);
      expect(rows[0]).toMatchObject({ device_id: "dev-a", fcm_token: null });
      expect(rows[1]).toMatchObject({ device_id: "dev-b", fcm_token: "tok-1" });
      await t.close();
    });
  });

  it("delete removes the row", async () => {
    await withTestDb(async ({ db, sql }) => {
      const t = await buildTestApp({ db, sql });
      const u = await t.login("01712345678");
      await put(t, u, "dev-1", body());
      const res = await t.app.inject({ method: "DELETE", url: "/v1/me/devices/dev-1", headers: t.as(u) });
      expect(res.statusCode).toBe(204);
      expect(await sql`select 1 from identity.devices`).toHaveLength(0);
      await t.close();
    });
  });

  it("listDeviceTokens skips rows without tokens", async () => {
    await withTestDb(async ({ db, sql }) => {
      const app = Fastify();
      const ctx = {
        db,
        config: testConfig(),
        limiter: new MemoryLimiter(),
        jobs: createJobs({ inline: true }),
        ports: { sms: new MemorySms() },
        clock: () => new Date(),
      } as unknown as ModuleContext;
      const f = await identityModule.register(app, ctx);
      const a = await f.createUserIfMissing("+8801712345678");
      const b = await f.createUserIfMissing("+8801812345678");
      await sql`insert into identity.devices (user_id, device_id, platform, fcm_token) values
        (${a.id}, 'd1', 'android', 'tok-a'), (${a.id}, 'd2', 'web', null), (${b.id}, 'd3', 'ios', 'tok-b')`;
      const list = await f.listDeviceTokens([a.id]);
      expect(list).toEqual([{ userId: a.id, deviceId: "d1", platform: "android", token: "tok-a" }]);
      expect(await f.listDeviceTokens([])).toEqual([]);
      await f.removeToken("tok-a");
      expect(await f.listDeviceTokens([a.id, b.id])).toHaveLength(1);
      await sql`update identity.devices set last_seen_at = '2020-01-01' where device_id = 'd3'`;
      await f.touchDevice(b.id, "d3");
      const [row] =
        await sql`select last_seen_at > now() - interval '1 minute' as fresh from identity.devices where device_id = 'd3'`;
      expect(row!.fresh).toBe(true);
    });
  });

  it("purge removes stale devices", async () => {
    await withTestDb(async ({ db, sql }) => {
      const t = await buildTestApp({ db, sql });
      const u = await t.login("01712345678");
      await put(t, u, "old", body({ fcmToken: "t-old" }));
      await put(t, u, "new", body({ fcmToken: "t-new" }));
      await sql`update identity.devices set last_seen_at = now() - interval '121 days' where device_id = 'old'`;
      await sql`update identity.devices set last_seen_at = now() - interval '119 days' where device_id = 'new'`;
      const jobs = createJobs({ inline: true });
      const def = purgeDevicesJob({ db, clock: () => new Date() });
      expect(def.name).toBe("identity.purge-devices");
      expect(def.cron).toBe("30 3 * * *");
      jobs.register(def);
      await jobs.send("identity.purge-devices", {});
      const rows = await sql`select device_id from identity.devices`;
      expect(rows.map((r) => r.device_id as string)).toEqual(["new"]);
      await t.close();
    });
  });

  it("route requires auth", async () => {
    await withTestDb(async ({ db, sql }) => {
      const t = await buildTestApp({ db, sql });
      const p = await t.app.inject({ method: "PUT", url: "/v1/me/devices/x", payload: body() });
      expect(p.statusCode).toBe(401);
      const d = await t.app.inject({ method: "DELETE", url: "/v1/me/devices/x" });
      expect(d.statusCode).toBe(401);
      await t.close();
    });
  });
});
