import { describe, expect, it } from "vitest";
import { buildTestApp, type TestApp, type Tokens } from "../../../tests/support/app-test.js";
import { withTestDb } from "../../../tests/support/db-test.js";

interface AccountRow {
  id: string;
  name: string;
  type: string;
  ownerUserId: string | null;
  openingBalancePaisa: number;
  balancePaisa: number | null;
  archivedAt: string | null;
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

const listAccounts = async (t: TestApp, who: Tokens, familyId: string, query = "") => {
  const res = await t.app.inject({
    method: "GET",
    url: `/v1/families/${familyId}/accounts${query}`,
    headers: t.as(who),
  });
  expect(res.statusCode).toBe(200);
  return res.json<AccountRow[]>();
};

const post = (t: TestApp, who: Tokens, familyId: string, payload: Record<string, unknown>) =>
  t.app.inject({
    method: "POST",
    url: `/v1/families/${familyId}/transactions`,
    headers: t.as(who),
    payload: { type: "expense", amountPaisa: 10_000, occurredAt: "2026-01-10T06:00:00.000Z", ...payload },
  });

const patchAccount = (t: TestApp, who: Tokens, familyId: string, id: string, payload: Record<string, unknown>) =>
  t.app.inject({
    method: "PATCH",
    url: `/v1/families/${familyId}/accounts/${id}`,
    headers: t.as(who),
    payload,
  });

describe("account balances (db)", () => {
  it("private expense of another member still changes a shared balance but amount is not revealed in lists", async () => {
    await withTestDb(async ({ db, sql }) => {
      const t = await buildTestApp({ db, sql });
      const owner = await t.login("01711111111");
      const member = await t.login("01722222222");
      const familyId = await createFamily(t, owner);
      await join(t, owner, familyId, member);
      const cash = (await listAccounts(t, owner, familyId)).find((a) => a.type === "cash")!;

      expect(
        (await post(t, owner, familyId, { type: "income", amountPaisa: 100_000, accountId: cash.id })).statusCode,
      ).toBe(201);
      expect(
        (await post(t, owner, familyId, { amountPaisa: 30_000, accountId: cash.id, isPrivate: true })).statusCode,
      ).toBe(201);

      const seen = (await listAccounts(t, member, familyId)).find((a) => a.id === cash.id)!;
      expect(seen.balancePaisa).toBe(70_000);
      const list = await t.app.inject({
        method: "GET",
        url: `/v1/families/${familyId}/transactions?month=2026-01`,
        headers: t.as(member),
      });
      expect(JSON.stringify(list.json())).not.toContain("30000");
      await t.close();
    });
  });

  it("balance null for other members' personal accounts", async () => {
    await withTestDb(async ({ db, sql }) => {
      const t = await buildTestApp({ db, sql });
      const owner = await t.login("01711111111");
      const member = await t.login("01722222222");
      const viewer = await t.login("01733333333");
      const familyId = await createFamily(t, owner);
      await join(t, owner, familyId, member);
      await join(t, owner, familyId, viewer, "viewer");

      const byType = (rows: AccountRow[]) => Object.fromEntries(rows.map((a) => [a.type, a.balancePaisa]));
      // The default bKash account belongs to the family owner.
      expect(byType(await listAccounts(t, owner, familyId))).toEqual({ cash: 0, bkash: 0 });
      expect(byType(await listAccounts(t, member, familyId))).toEqual({ cash: 0, bkash: null });
      expect(byType(await listAccounts(t, viewer, familyId))).toEqual({ cash: null, bkash: null });
      await t.close();
    });
  });

  it("transfer requires a different destination", async () => {
    await withTestDb(async ({ db, sql }) => {
      const t = await buildTestApp({ db, sql });
      const owner = await t.login("01711111111");
      const familyId = await createFamily(t, owner);
      const [cash, bkash] = await listAccounts(t, owner, familyId);

      const base = { type: "transfer", amountPaisa: 5_000, feePaisa: 20 };
      expect((await post(t, owner, familyId, { ...base, accountId: cash!.id })).statusCode).toBe(400);
      expect((await post(t, owner, familyId, { ...base, accountId: cash!.id, toAccountId: cash!.id })).statusCode).toBe(
        400,
      );
      expect((await post(t, owner, familyId, { accountId: cash!.id, toAccountId: bkash!.id })).statusCode).toBe(400);
      const ok = await post(t, owner, familyId, { ...base, type: "income", amountPaisa: 50_000, accountId: cash!.id });
      expect(ok.statusCode).toBe(201);
      expect(
        (await post(t, owner, familyId, { ...base, accountId: cash!.id, toAccountId: bkash!.id })).statusCode,
      ).toBe(201);

      const after = await listAccounts(t, owner, familyId);
      expect(after.find((a) => a.id === cash!.id)!.balancePaisa).toBe(50_000 - 5_020);
      expect(after.find((a) => a.id === bkash!.id)!.balancePaisa).toBe(5_000);
      await t.close();
    });
  });

  it("archived account rejected for new transactions", async () => {
    await withTestDb(async ({ db, sql }) => {
      const t = await buildTestApp({ db, sql });
      const owner = await t.login("01711111111");
      const familyId = await createFamily(t, owner);
      const [cash, bkash] = await listAccounts(t, owner, familyId);
      const old = await post(t, owner, familyId, { accountId: bkash!.id });
      expect(old.statusCode).toBe(201);

      expect((await patchAccount(t, owner, familyId, bkash!.id, { archived: true })).statusCode).toBe(200);
      const rejected = await post(t, owner, familyId, { accountId: bkash!.id });
      expect(rejected.statusCode).toBe(400);
      expect(rejected.json<{ error: { code: string } }>().error.code).toBe("invalid_account");

      // Old rows keep the archived account and stay editable; the account is hidden by default.
      const edit = await t.app.inject({
        method: "PATCH",
        url: `/v1/families/${familyId}/transactions/${old.json<{ id: string }>().id}`,
        headers: t.as(owner),
        payload: { note: "still fine" },
      });
      expect(edit.statusCode).toBe(200);
      expect((await listAccounts(t, owner, familyId)).map((a) => a.id)).toEqual([cash!.id]);
      const all = await listAccounts(t, owner, familyId, "?includeArchived=true");
      expect(all.find((a) => a.id === bkash!.id)!.archivedAt).not.toBeNull();
      await t.close();
    });
  });

  it("cannot archive the last account", async () => {
    await withTestDb(async ({ db, sql }) => {
      const t = await buildTestApp({ db, sql });
      const owner = await t.login("01711111111");
      const familyId = await createFamily(t, owner);
      const [cash, bkash] = await listAccounts(t, owner, familyId);
      expect((await patchAccount(t, owner, familyId, bkash!.id, { archived: true })).statusCode).toBe(200);
      const res = await patchAccount(t, owner, familyId, cash!.id, { archived: true });
      expect(res.statusCode).toBe(409);
      expect(res.json<{ error: { code: string } }>().error.code).toBe("last_account");
      await t.close();
    });
  });
});
