import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import { buildTestApp, type TestApp, type Tokens } from "../../../tests/support/app-test.js";
import { withTestDb } from "../../../tests/support/db-test.js";
import type { EventBus } from "../../platform/events/bus.js";
import { createTransaction } from "./app/create-transaction.js";
import type { LedgerDeps } from "./app/deps.js";

async function userId(t: TestApp, tokens: Tokens): Promise<string> {
  const me = await t.app.inject({ method: "GET", url: "/v1/me", headers: t.as(tokens) });
  return me.json<{ user: { id: string } }>().user.id;
}

async function setup(t: TestApp) {
  const owner = await t.login("01711111111");
  const res = await t.app.inject({
    method: "POST",
    url: "/v1/families",
    headers: t.as(owner),
    payload: { name: "রহিম পরিবার" },
  });
  const familyId = res.json<{ id: string }>().id;
  return { owner, familyId, url: `/v1/families/${familyId}/transactions` };
}

async function join(t: TestApp, owner: Tokens, familyId: string, who: Tokens, role: string) {
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

const body = (over: Record<string, unknown> = {}) => ({
  type: "expense",
  amountPaisa: 50_000,
  occurredAt: "2026-01-10T06:00:00.000Z",
  ...over,
});

type Row = { id: string; hlc: string; paidByUserId: string; deletedAt: string | null };
type Err = { error: { code: string; details?: { transactionId?: string } } };

describe("transaction use cases (db)", () => {
  it("create stamps an hlc and a sync sequence", async () => {
    await withTestDb(async ({ db, sql }) => {
      const t = await buildTestApp({ db, sql });
      const { owner, url } = await setup(t);
      const a = await t.app.inject({ method: "POST", url, headers: t.as(owner), payload: body() });
      await t.app.inject({ method: "POST", url, headers: t.as(owner), payload: body() });
      expect(a.statusCode).toBe(201);
      expect(a.json<Row>().hlc).not.toBe("");
      expect(a.json<Row>().paidByUserId).toBe(await userId(t, owner));
      const seqs = await sql<{ sync_seq: string }[]>`select sync_seq from ledger.transactions order by sync_seq`;
      expect(seqs).toHaveLength(2);
      expect(Number(seqs[1]!.sync_seq)).toBeGreaterThan(Number(seqs[0]!.sync_seq));
      await t.close();
    });
  });

  it("create publishes TransactionCreated in the same transaction", async () => {
    await withTestDb(async ({ db, sql }) => {
      const t = await buildTestApp({ db, sql });
      const { owner, familyId, url } = await setup(t);
      const res = await t.app.inject({
        method: "POST",
        url,
        headers: t.as(owner),
        payload: body({ note: "বাজার", trxId: "BK1", counterparty: "Shop", feePaisa: 500 }),
      });
      const events = await sql<{ payload: Record<string, unknown> }[]>`
        select payload from platform.outbox where name = 'ledger.TransactionCreated.v1'`;
      expect(events).toHaveLength(1);
      expect(events[0]!.payload).toEqual({
        familyId,
        transactionId: res.json<Row>().id,
        type: "expense",
        amountPaisa: 50_000,
        feePaisa: 500,
        categoryId: null,
        accountId: null,
        occurredAt: "2026-01-10T06:00:00.000Z",
        isPrivate: false,
        createdBy: await userId(t, owner),
        paidByUserId: await userId(t, owner),
        source: "manual",
        note: "বাজার",
      });

      // Rollback: when publishing throws, no new row remains.
      const failing = {
        publish: async () => {
          throw new Error("outbox down");
        },
      } as unknown as EventBus;
      const deps = {
        db,
        bus: failing,
        families: {
          requireRole: async () => ({ role: "owner" }),
          canEditAll: () => true,
          listMemberIds: async () => [],
        },
      } as unknown as LedgerDeps;
      const data = { ...body(), feePaisa: 0, source: "manual", isPrivate: false } as never;
      await expect(
        createTransaction(deps, { familyId, actor: { userId: await userId(t, owner), role: "owner" }, data }),
      ).rejects.toThrow("outbox down");
      expect(await sql`select 1 from ledger.transactions`).toHaveLength(1);
      await t.close();
    });
  });

  it("same client id and creator returns 200 with the same row", async () => {
    await withTestDb(async ({ db, sql }) => {
      const t = await buildTestApp({ db, sql });
      const { owner, url } = await setup(t);
      const id = randomUUID();
      const first = await t.app.inject({ method: "POST", url, headers: t.as(owner), payload: body({ id }) });
      const again = await t.app.inject({ method: "POST", url, headers: t.as(owner), payload: body({ id }) });
      expect(first.statusCode).toBe(201);
      expect(again.statusCode).toBe(200);
      expect(again.json<Row>().id).toBe(id);
      expect(again.json<Row>().hlc).toBe(first.json<Row>().hlc);
      expect(await sql`select 1 from platform.outbox where name = 'ledger.TransactionCreated.v1'`).toHaveLength(1);
      await t.close();
    });
  });

  it("same client id from another creator returns duplicate_id", async () => {
    await withTestDb(async ({ db, sql }) => {
      const t = await buildTestApp({ db, sql });
      const { owner, familyId, url } = await setup(t);
      const member = await t.login("01722222222");
      await join(t, owner, familyId, member, "member");
      const id = randomUUID();
      await t.app.inject({ method: "POST", url, headers: t.as(owner), payload: body({ id }) });
      const res = await t.app.inject({ method: "POST", url, headers: t.as(member), payload: body({ id }) });
      expect(res.statusCode).toBe(409);
      expect(res.json<Err>().error.code).toBe("duplicate_id");
      await t.close();
    });
  });

  it("same trxId returns duplicate_trx_id", async () => {
    await withTestDb(async ({ db, sql }) => {
      const t = await buildTestApp({ db, sql });
      const { owner, url } = await setup(t);
      const first = await t.app.inject({ method: "POST", url, headers: t.as(owner), payload: body({ trxId: "BK1" }) });
      const dup = await t.app.inject({ method: "POST", url, headers: t.as(owner), payload: body({ trxId: "BK1" }) });
      expect(dup.statusCode).toBe(409);
      expect(dup.json<Err>().error.code).toBe("duplicate_trx_id");
      expect(dup.json<Err>().error.details?.transactionId).toBe(first.json<Row>().id);
      await t.close();
    });
  });

  it("duplicate details hidden for private rows", async () => {
    await withTestDb(async ({ db, sql }) => {
      const t = await buildTestApp({ db, sql });
      const { owner, familyId, url } = await setup(t);
      const member = await t.login("01722222222");
      await join(t, owner, familyId, member, "member");
      await t.app.inject({
        method: "POST",
        url,
        headers: t.as(owner),
        payload: body({ trxId: "BK9", isPrivate: true }),
      });
      const dup = await t.app.inject({ method: "POST", url, headers: t.as(member), payload: body({ trxId: "BK9" }) });
      expect(dup.statusCode).toBe(409);
      expect(dup.json<Err>().error.code).toBe("duplicate_trx_id");
      expect(dup.json<Err>().error.details).toBeUndefined();
      await t.close();
    });
  });

  it("member cannot set paidByUserId to another user", async () => {
    await withTestDb(async ({ db, sql }) => {
      const t = await buildTestApp({ db, sql });
      const { owner, familyId, url } = await setup(t);
      const member = await t.login("01722222222");
      await join(t, owner, familyId, member, "member");
      const res = await t.app.inject({
        method: "POST",
        url,
        headers: t.as(member),
        payload: body({ paidByUserId: await userId(t, owner) }),
      });
      expect(res.statusCode).toBe(403);
      expect(res.json<Err>().error.code).toBe("forbidden");
      await t.close();
    });
  });

  it("admin can", async () => {
    await withTestDb(async ({ db, sql }) => {
      const t = await buildTestApp({ db, sql });
      const { owner, familyId, url } = await setup(t);
      const admin = await t.login("01722222222");
      await join(t, owner, familyId, admin, "admin");
      const res = await t.app.inject({
        method: "POST",
        url,
        headers: t.as(admin),
        payload: body({ paidByUserId: await userId(t, owner) }),
      });
      expect(res.statusCode).toBe(201);
      expect(res.json<Row>().paidByUserId).toBe(await userId(t, owner));
      await t.close();
    });
  });

  it("member edits own but not others (403)", async () => {
    await withTestDb(async ({ db, sql }) => {
      const t = await buildTestApp({ db, sql });
      const { owner, familyId, url } = await setup(t);
      const member = await t.login("01722222222");
      await join(t, owner, familyId, member, "member");
      const mine = (await t.app.inject({ method: "POST", url, headers: t.as(member), payload: body() })).json<Row>();
      const theirs = (await t.app.inject({ method: "POST", url, headers: t.as(owner), payload: body() })).json<Row>();
      const patch = (id: string) =>
        t.app.inject({ method: "PATCH", url: `${url}/${id}`, headers: t.as(member), payload: { note: "x" } });
      expect((await patch(mine.id)).statusCode).toBe(200);
      expect((await patch(theirs.id)).statusCode).toBe(403);
      await t.close();
    });
  });

  it("update bumps hlc above previous", async () => {
    await withTestDb(async ({ db, sql }) => {
      const t = await buildTestApp({ db, sql });
      const { owner, url } = await setup(t);
      const row = (await t.app.inject({ method: "POST", url, headers: t.as(owner), payload: body() })).json<Row>();
      const patch = await t.app.inject({
        method: "PATCH",
        url: `${url}/${row.id}`,
        headers: t.as(owner),
        payload: { amountPaisa: 70_000 },
      });
      expect(patch.json<Row>().hlc > row.hlc).toBe(true);
      const ev = await sql<{ payload: { kind: string; amountPaisa: number; before: Record<string, unknown> } }[]>`
        select payload from platform.outbox where name = 'ledger.TransactionUpdated.v1'`;
      expect(ev[0]!.payload.kind).toBe("edit");
      expect(ev[0]!.payload.amountPaisa).toBe(70_000);
      expect(ev[0]!.payload.before).toEqual({
        type: "expense",
        amountPaisa: 50_000,
        feePaisa: 0,
        categoryId: null,
        occurredAt: "2026-01-10T06:00:00.000Z",
        isPrivate: false,
      });
      await t.close();
    });
  });

  it("delete sets deletedAt and publishes TransactionDeleted", async () => {
    await withTestDb(async ({ db, sql }) => {
      const t = await buildTestApp({ db, sql });
      const { owner, url } = await setup(t);
      const row = (await t.app.inject({ method: "POST", url, headers: t.as(owner), payload: body() })).json<Row>();
      const del = await t.app.inject({ method: "DELETE", url: `${url}/${row.id}`, headers: t.as(owner) });
      expect(del.statusCode).toBe(204);
      const rows = await sql<{ deleted_at: Date | null; hlc: string }[]>`
        select deleted_at, hlc from ledger.transactions`;
      expect(rows[0]!.deleted_at).not.toBeNull();
      expect(rows[0]!.hlc > row.hlc).toBe(true);
      expect(await sql`select 1 from platform.outbox where name = 'ledger.TransactionDeleted.v1'`).toHaveLength(1);
      await t.close();
    });
  });

  it("viewer cannot create", async () => {
    await withTestDb(async ({ db, sql }) => {
      const t = await buildTestApp({ db, sql });
      const { owner, familyId, url } = await setup(t);
      const viewer = await t.login("01722222222");
      await join(t, owner, familyId, viewer, "viewer");
      const res = await t.app.inject({ method: "POST", url, headers: t.as(viewer), payload: body() });
      expect(res.statusCode).toBe(403);
      await t.close();
    });
  });

  it("suspended family returns 423", async () => {
    await withTestDb(async ({ db, sql }) => {
      const t = await buildTestApp({ db, sql });
      const { owner, familyId, url } = await setup(t);
      await sql`update families.families set status = 'suspended', suspended_at = now() where id = ${familyId}`;
      const res = await t.app.inject({ method: "POST", url, headers: t.as(owner), payload: body() });
      expect(res.statusCode).toBe(423);
      expect(res.json<Err>().error.code).toBe("family_suspended");
      await t.close();
    });
  });
});
