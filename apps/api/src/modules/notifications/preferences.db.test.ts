import { describe, expect, it } from "vitest";
import { buildTestApp, type Tokens } from "../../../tests/support/app-test.js";
import { withTestDb } from "../../../tests/support/db-test.js";

type T = Awaited<ReturnType<typeof buildTestApp>>;
const get = (t: T, u: Tokens) =>
  t.app.inject({ method: "GET", url: "/v1/me/notification-preferences", headers: t.as(u) });
const put = (t: T, u: Tokens, payload: object) =>
  t.app.inject({ method: "PUT", url: "/v1/me/notification-preferences", headers: t.as(u), payload });

const DEFAULTS = {
  kinds: {
    budget_threshold: true,
    nudge: true,
    message: true,
    daily_reminder: true,
    bill_due: true,
    call_missed: true,
  },
  quietStart: "22:00",
  quietEnd: "06:00",
  dailyReminderTime: "21:00",
  dailyReminderEnabled: true,
  hidePresence: false,
};

describe("notification preferences (db)", () => {
  it("defaults without row", async () => {
    await withTestDb(async ({ db, sql }) => {
      const t = await buildTestApp({ db, sql });
      const u = await t.login("01712345678");
      const res = await get(t, u);
      expect(res.statusCode).toBe(200);
      expect(res.json()).toEqual(DEFAULTS);
      const rows = await sql`select 1 from notifications.preferences`;
      expect(rows).toHaveLength(0);
      await t.close();
    });
  });

  it("upsert", async () => {
    await withTestDb(async ({ db, sql }) => {
      const t = await buildTestApp({ db, sql });
      const u = await t.login("01712345678");
      const body = { kinds: { nudge: false }, quietStart: "23:30", dailyReminderTime: "20:15", hidePresence: true };
      const res = await put(t, u, body);
      expect(res.statusCode).toBe(200);
      const expected = {
        ...DEFAULTS,
        kinds: { ...DEFAULTS.kinds, nudge: false },
        quietStart: "23:30",
        dailyReminderTime: "20:15",
        hidePresence: true,
      };
      expect(res.json()).toEqual(expected);
      expect((await get(t, u)).json()).toEqual(expected);
      const again = await put(t, u, { dailyReminderEnabled: false });
      expect(again.json()).toEqual({ ...expected, dailyReminderEnabled: false });
      const rows = await sql`select 1 from notifications.preferences`;
      expect(rows).toHaveLength(1);
      await t.close();
    });
  });

  it("rejects 25:00", async () => {
    await withTestDb(async ({ db, sql }) => {
      const t = await buildTestApp({ db, sql });
      const u = await t.login("01712345678");
      for (const bad of [{ quietStart: "25:00" }, { quietEnd: "6:00" }, { dailyReminderTime: "21:60" }]) {
        const res = await put(t, u, bad);
        expect(res.statusCode).toBe(400);
        expect(res.json().error.code).toBe("invalid_request");
      }
      await t.close();
    });
  });

  it("other users cannot read mine", async () => {
    await withTestDb(async ({ db, sql }) => {
      const t = await buildTestApp({ db, sql });
      const a = await t.login("01712345678");
      const b = await t.login("01812345678");
      await put(t, a, { quietStart: "01:00", hidePresence: true });
      expect((await get(t, b)).json()).toEqual(DEFAULTS);
      expect((await get(t, a)).json().quietStart).toBe("01:00");
      expect((await t.app.inject({ method: "GET", url: "/v1/me/notification-preferences" })).statusCode).toBe(401);
      await t.close();
    });
  });
});
