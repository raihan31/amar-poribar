import { describe, expect, it } from "vitest";
import { buildTestApp, type TestApp, type Tokens } from "../../../tests/support/app-test.js";
import { withTestDb } from "../../../tests/support/db-test.js";
import type { Sql } from "../../platform/db.js";

async function createFamily(t: TestApp, owner: Tokens) {
  const res = await t.app.inject({
    method: "POST",
    url: "/v1/families",
    headers: t.as(owner),
    payload: { name: "রহিম পরিবার" },
  });
  return res.json<{ id: string }>().id;
}

const invite = (t: TestApp, who: Tokens, familyId: string, payload: object = {}) =>
  t.app.inject({ method: "POST", url: `/v1/families/${familyId}/invites`, headers: t.as(who), payload });

const inbox = (sql: Sql) =>
  sql<{ kind: string; body: string; data: { token?: string } }[]>`
    select kind, body, data from notifications.inbox_items where kind = 'invite'`;

describe("invite delivery (db)", () => {
  it("invite for an existing user creates an inbox item", async () => {
    await withTestDb(async ({ db, sql }) => {
      const t = await buildTestApp({ db, sql });
      const owner = await t.login("01711111111");
      await t.login("01722222222");
      const familyId = await createFamily(t, owner);
      t.fakes.sms.clear();
      const created = await invite(t, owner, familyId, { phone: "01722222222" });
      await t.drain();
      const rows = await inbox(sql);
      expect(rows).toHaveLength(1);
      expect(rows[0]!.data.token).toBe(created.json().token);
      expect(rows[0]!.body).toContain("রহিম পরিবার");
      expect(t.fakes.sms.sent).toHaveLength(0);
      await t.close();
    });
  });

  it("invite for an unknown phone sends one SMS with the link", async () => {
    await withTestDb(async ({ db, sql }) => {
      const t = await buildTestApp({ db, sql });
      const owner = await t.login("01711111111");
      const familyId = await createFamily(t, owner);
      t.fakes.sms.clear();
      const created = await invite(t, owner, familyId, { phone: "01733333333" });
      await t.drain();
      expect(t.fakes.sms.sent).toHaveLength(1);
      const sms = t.fakes.sms.last()!;
      expect(sms.to).toBe("+8801733333333");
      expect(sms.kind).toBe("invite");
      expect(sms.text).toContain(`http://localhost:3000/join/${created.json().token}`);
      expect(sms.text.replace(/\s*https?:\/\/\S+$/, "").length).toBeLessThanOrEqual(70);
      expect(await inbox(sql)).toHaveLength(0);
      await t.close();
    });
  });

  it("handler is idempotent on retry", async () => {
    await withTestDb(async ({ db, sql }) => {
      const t = await buildTestApp({ db, sql });
      const owner = await t.login("01711111111");
      const familyId = await createFamily(t, owner);
      t.fakes.sms.clear();
      await invite(t, owner, familyId, { phone: "01733333333" });
      await t.drain();
      // Simulate a retry: the outbox row is delivered again from scratch.
      await sql`update platform.outbox set status = 'pending', next_attempt_at = now()`;
      await sql`delete from platform.outbox_deliveries`;
      await t.drain();
      expect(t.fakes.sms.sent).toHaveLength(1);
      await t.close();
    });
  });

  it("invite without phone sends nothing", async () => {
    await withTestDb(async ({ db, sql }) => {
      const t = await buildTestApp({ db, sql });
      const owner = await t.login("01711111111");
      const familyId = await createFamily(t, owner);
      t.fakes.sms.clear();
      await invite(t, owner, familyId);
      await t.drain();
      const events = await sql`select 1 from platform.outbox where name = 'families.InviteCreated.v1'`;
      expect(events).toHaveLength(0);
      expect(t.fakes.sms.sent).toHaveLength(0);
      expect(await inbox(sql)).toHaveLength(0);
      await t.close();
    });
  });
});
