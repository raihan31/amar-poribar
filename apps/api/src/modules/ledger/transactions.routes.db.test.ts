import { sql as q } from "drizzle-orm";
import Fastify from "fastify";
import { describe, expect, it } from "vitest";
import { buildTestApp, type TestApp, type Tokens } from "../../../tests/support/app-test.js";
import { withTestDb } from "../../../tests/support/db-test.js";
import { EventBus } from "../../platform/events/bus.js";
import type { ModuleContext } from "../../platform/module.js";
import { ledgerModule } from "./index.js";

async function userId(t: TestApp, tokens: Tokens): Promise<string> {
  const me = await t.app.inject({ method: "GET", url: "/v1/me", headers: t.as(tokens) });
  return me.json<{ user: { id: string } }>().user.id;
}

async function createFamily(t: TestApp, tokens: Tokens): Promise<string> {
  const res = await t.app.inject({
    method: "POST",
    url: "/v1/families",
    headers: t.as(tokens),
    payload: { name: "রহিম পরিবার" },
  });
  expect(res.statusCode).toBe(201);
  return res.json<{ id: string }>().id;
}

async function join(t: TestApp, owner: Tokens, familyId: string, who: Tokens, role = "member") {
  const invite = await t.app.inject({
    method: "POST",
    url: `/v1/families/${familyId}/invites`,
    headers: t.as(owner),
    payload: { role },
  });
  const res = await t.app.inject({
    method: "POST",
    url: `/v1/invites/${invite.json<{ token: string }>().token}/accept`,
    headers: t.as(who),
  });
  expect(res.statusCode).toBe(200);
}

const txn = (over: Record<string, unknown> = {}) => ({
  type: "expense",
  amountPaisa: 50_000,
  occurredAt: "2026-01-10T06:00:00.000Z",
  ...over,
});

describe("ledger routes (db)", () => {
  it("POST /v1/families seeds categories and accounts as before", async () => {
    await withTestDb(async ({ db, sql }) => {
      const t = await buildTestApp({ db, sql });
      const owner = await t.login("01711111111");
      const familyId = await createFamily(t, owner);
      const cats = await t.app.inject({
        method: "GET",
        url: `/v1/families/${familyId}/categories`,
        headers: t.as(owner),
      });
      expect(cats.json<unknown[]>().length).toBeGreaterThanOrEqual(20);
      const accs = await t.app.inject({
        method: "GET",
        url: `/v1/families/${familyId}/accounts`,
        headers: t.as(owner),
      });
      expect(accs.json<{ type: string }[]>().map((a) => a.type)).toEqual(["cash", "bkash"]);
      await t.close();
    });
  });

  it("create transaction publishes an outbox event", async () => {
    await withTestDb(async ({ db, sql }) => {
      const t = await buildTestApp({ db, sql });
      const owner = await t.login("01711111111");
      const familyId = await createFamily(t, owner);
      const res = await t.app.inject({
        method: "POST",
        url: `/v1/families/${familyId}/transactions`,
        headers: t.as(owner),
        payload: txn(),
      });
      expect(res.statusCode).toBe(201);
      const row = res.json<{ id: string; hlc: string }>();
      expect(row.hlc).not.toBe("");
      const events = await sql<{ name: string; payload: Record<string, unknown> }[]>`
        select name, payload from platform.outbox where name like 'ledger.%'`;
      expect(events).toHaveLength(1);
      expect(events[0]!.name).toBe("ledger.TransactionCreated.v1");
      expect(events[0]!.payload).toMatchObject({
        familyId,
        transactionId: row.id,
        type: "expense",
        amountPaisa: 50_000,
        categoryId: null,
        occurredAt: "2026-01-10T06:00:00.000Z",
        isPrivate: false,
        createdBy: await userId(t, owner),
      });

      const patch = await t.app.inject({
        method: "PATCH",
        url: `/v1/families/${familyId}/transactions/${row.id}`,
        headers: t.as(owner),
        payload: { amountPaisa: 60_000 },
      });
      expect(patch.statusCode).toBe(200);
      expect(patch.json<{ hlc: string }>().hlc > row.hlc).toBe(true);
      const del = await t.app.inject({
        method: "DELETE",
        url: `/v1/families/${familyId}/transactions/${row.id}`,
        headers: t.as(owner),
      });
      expect(del.statusCode).toBe(204);
      const names = await sql<
        { name: string }[]
      >`select name from platform.outbox where name like 'ledger.%' order by id`;
      expect(names.map((n) => n.name)).toEqual([
        "ledger.TransactionCreated.v1",
        "ledger.TransactionUpdated.v1",
        "ledger.TransactionDeleted.v1",
      ]);
      await t.close();
    });
  });

  it("private rows are visible only to creator", async () => {
    await withTestDb(async ({ db, sql }) => {
      const t = await buildTestApp({ db, sql });
      const owner = await t.login("01711111111");
      const member = await t.login("01722222222");
      const familyId = await createFamily(t, owner);
      await join(t, owner, familyId, member);
      const create = await t.app.inject({
        method: "POST",
        url: `/v1/families/${familyId}/transactions`,
        headers: t.as(owner),
        payload: txn({ isPrivate: true }),
      });
      const id = create.json<{ id: string }>().id;
      const url = `/v1/families/${familyId}/transactions`;
      expect((await t.app.inject({ method: "GET", url, headers: t.as(owner) })).json<unknown[]>()).toHaveLength(1);
      expect((await t.app.inject({ method: "GET", url, headers: t.as(member) })).json<unknown[]>()).toHaveLength(0);
      const edit = await t.app.inject({
        method: "PATCH",
        url: `${url}/${id}`,
        headers: t.as(member),
        payload: { note: "x" },
      });
      expect(edit.statusCode).toBe(404);
      await t.close();
    });
  });

  it("duplicate trxId returns 409", async () => {
    await withTestDb(async ({ db, sql }) => {
      const t = await buildTestApp({ db, sql });
      const owner = await t.login("01711111111");
      const familyId = await createFamily(t, owner);
      const send = () =>
        t.app.inject({
          method: "POST",
          url: `/v1/families/${familyId}/transactions`,
          headers: t.as(owner),
          payload: txn({ trxId: "BK12345678" }),
        });
      expect((await send()).statusCode).toBe(201);
      const dup = await send();
      expect(dup.statusCode).toBe(409);
      expect(dup.json<{ error: { code: string } }>().error.code).toBe("duplicate");
      const events = await sql`select 1 from platform.outbox where name = 'ledger.TransactionCreated.v1'`;
      expect(events).toHaveLength(1);
      await t.close();
    });
  });

  it("member cannot edit others entry", async () => {
    await withTestDb(async ({ db, sql }) => {
      const t = await buildTestApp({ db, sql });
      const owner = await t.login("01711111111");
      const member = await t.login("01722222222");
      const familyId = await createFamily(t, owner);
      await join(t, owner, familyId, member);
      const create = await t.app.inject({
        method: "POST",
        url: `/v1/families/${familyId}/transactions`,
        headers: t.as(owner),
        payload: txn(),
      });
      const url = `/v1/families/${familyId}/transactions/${create.json<{ id: string }>().id}`;
      const edit = await t.app.inject({ method: "PATCH", url, headers: t.as(member), payload: { note: "x" } });
      expect(edit.statusCode).toBe(403);
      const del = await t.app.inject({ method: "DELETE", url, headers: t.as(member) });
      expect(del.statusCode).toBe(403);
      // The owner (admin or above) may edit anyone's entry.
      const own = await t.app.inject({ method: "PATCH", url, headers: t.as(owner), payload: { note: "ok" } });
      expect(own.statusCode).toBe(200);
      await t.close();
    });
  });

  it("seedDefaults runs inside the family creation transaction", async () => {
    await withTestDb(async ({ db, sql }) => {
      const bus = new EventBus();
      const app = Fastify();
      app.decorate("authenticate", async () => {});
      const ctx = {
        db,
        bus,
        facades: {
          families: { requireRole: async () => ({ role: "owner", family: { id: "f", name: "f", role: "owner" } }) },
        },
      } as unknown as ModuleContext;
      await ledgerModule.register(app, ctx);

      const familyId = "11111111-1111-4111-8111-111111111111";
      const userId = "22222222-2222-4222-8222-222222222222";
      await expect(
        db.transaction(async (tx) => {
          await bus.publish(tx, "families.FamilyCreated.v1", {
            familyId,
            ownerUserId: userId,
            name: "x",
            createdAt: new Date().toISOString(),
          });
          const seeded = await tx.execute<{ n: number }>(
            q`select count(*)::int as n from ledger.categories where family_id = ${familyId}`,
          );
          expect(seeded[0]!.n).toBeGreaterThanOrEqual(20);
          throw new Error("kill the transaction");
        }),
      ).rejects.toThrow("kill the transaction");
      expect(await sql`select 1 from ledger.categories where family_id = ${familyId}`).toHaveLength(0);
      expect(await sql`select 1 from ledger.accounts where family_id = ${familyId}`).toHaveLength(0);
      expect(await sql`select 1 from platform.outbox`).toHaveLength(0);
      await app.close();
    });
  });

  it("monthTotals matches e2e expectations", async () => {
    await withTestDb(async ({ db, sql }) => {
      const t = await buildTestApp({ db, sql });
      const owner = await t.login("01711111111");
      const member = await t.login("01722222222");
      const familyId = await createFamily(t, owner);
      await join(t, owner, familyId, member);
      const url = `/v1/families/${familyId}/transactions`;
      const post = (who: Tokens, body: object) =>
        t.app.inject({ method: "POST", url, headers: t.as(who), payload: body });
      await post(owner, txn({ amountPaisa: 100_000, feePaisa: 500 }));
      await post(member, txn({ amountPaisa: 20_000 }));
      await post(member, txn({ amountPaisa: 7_000, isPrivate: true }));
      await post(owner, txn({ type: "income", amountPaisa: 300_000 }));
      await post(owner, txn({ amountPaisa: 99_999, occurredAt: "2026-02-10T06:00:00.000Z" }));

      const summary = (who: Tokens) =>
        t.app.inject({
          method: "GET",
          url: `/v1/families/${familyId}/reports/summary?month=2026-01`,
          headers: t.as(who),
        });
      const asOwner = (await summary(owner)).json<{
        incomePaisa: number;
        expensePaisa: number;
        byMember: { id: string; totalPaisa: number }[];
      }>();
      expect(asOwner.incomePaisa).toBe(300_000);
      // 100_000 + 500 fee + 20_000; the member's private 7_000 is hidden from the owner.
      expect(asOwner.expensePaisa).toBe(120_500);
      expect(asOwner.byMember).toEqual([
        { id: await userId(t, owner), name: "+8801711111111", totalPaisa: 100_500 },
        { id: await userId(t, member), name: "+8801722222222", totalPaisa: 20_000 },
      ]);
      const asMember = (await summary(member)).json<{ expensePaisa: number }>();
      expect(asMember.expensePaisa).toBe(127_500);
      await t.close();
    });
  });
});
