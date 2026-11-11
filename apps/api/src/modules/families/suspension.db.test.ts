import { describe, expect, it } from "vitest";
import { buildTestApp, type TestApp } from "../../../tests/support/app-test.js";
import { withTestDb } from "../../../tests/support/db-test.js";
import { EventBus } from "../../platform/events/bus.js";
import { suspendFamily, unsuspendFamily } from "./app/suspension.js";

async function setup(t: TestApp) {
  const owner = await t.login("01711111111");
  const res = await t.app.inject({
    method: "POST",
    url: "/v1/families",
    headers: t.as(owner),
    payload: { name: "রহিম পরিবার" },
  });
  return { owner, familyId: res.json<{ id: string }>().id };
}

const createTxn = (t: TestApp, owner: Awaited<ReturnType<TestApp["login"]>>, familyId: string) =>
  t.app.inject({
    method: "POST",
    url: `/v1/families/${familyId}/transactions`,
    headers: t.as(owner),
    payload: { type: "expense", amountPaisa: 50_000, occurredAt: "2026-01-10T06:00:00.000Z" },
  });

const staff = { kind: "staff", id: "staff-1" } as const;

describe("suspension (db)", () => {
  it("suspended family rejects transaction create with 423", async () => {
    await withTestDb(async ({ db, sql }) => {
      const t = await buildTestApp({ db, sql });
      const { owner, familyId } = await setup(t);
      await suspendFamily({ db, bus: new EventBus(), clock: () => new Date() }, familyId, "non-payment", staff);
      const res = await createTxn(t, owner, familyId);
      expect(res.statusCode).toBe(423);
      const err = res.json<{ error: { code: string; message: string; details: { message_en: string } } }>().error;
      expect(err.code).toBe("family_suspended");
      expect(err.message).toBe("এই পরিবারের হিসাব এখন শুধু দেখা যাবে");
      expect(err.details.message_en).toMatch(/read-only/i);
      await t.close();
    });
  });

  it("suspended family still allows reads", async () => {
    await withTestDb(async ({ db, sql }) => {
      const t = await buildTestApp({ db, sql });
      const { owner, familyId } = await setup(t);
      await suspendFamily({ db, bus: new EventBus(), clock: () => new Date() }, familyId, "x", staff);
      const res = await t.app.inject({
        method: "GET",
        url: `/v1/families/${familyId}/transactions`,
        headers: t.as(owner),
      });
      expect(res.statusCode).toBe(200);
      await t.close();
    });
  });

  it("unsuspend restores writes", async () => {
    await withTestDb(async ({ db, sql }) => {
      const t = await buildTestApp({ db, sql });
      const { owner, familyId } = await setup(t);
      const deps = { db, bus: new EventBus(), clock: () => new Date() };
      await suspendFamily(deps, familyId, "x", staff);
      await unsuspendFamily(deps, familyId, staff);
      const res = await createTxn(t, owner, familyId);
      expect(res.statusCode).toBe(201);
      await t.close();
    });
  });
});
