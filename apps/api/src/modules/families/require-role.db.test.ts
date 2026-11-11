import { describe, expect, it } from "vitest";
import { buildTestApp, type TestApp, type Tokens } from "../../../tests/support/app-test.js";
import { withTestDb } from "../../../tests/support/db-test.js";
import { HttpError } from "../../platform/errors.js";
import { requireRole } from "./app/require-role.js";

async function userId(t: TestApp, tokens: Tokens): Promise<string> {
  const me = await t.app.inject({ method: "GET", url: "/v1/me", headers: t.as(tokens) });
  return me.json<{ user: { id: string } }>().user.id;
}

async function setup(t: TestApp) {
  const owner = await t.login("01711111111");
  const viewer = await t.login("01722222222");
  const stranger = await t.login("01733333333");
  const created = await t.app.inject({
    method: "POST",
    url: "/v1/families",
    headers: t.as(owner),
    payload: { name: "রহিম পরিবার" },
  });
  const familyId = created.json<{ id: string }>().id;
  const invite = await t.app.inject({
    method: "POST",
    url: `/v1/families/${familyId}/invites`,
    headers: t.as(owner),
    payload: { role: "viewer" },
  });
  await t.app.inject({
    method: "POST",
    url: `/v1/invites/${invite.json<{ token: string }>().token}/accept`,
    headers: t.as(viewer),
  });
  return {
    familyId,
    ownerId: await userId(t, owner),
    viewerId: await userId(t, viewer),
    strangerId: await userId(t, stranger),
  };
}

async function status(p: Promise<unknown>): Promise<number | "ok"> {
  try {
    await p;
    return "ok";
  } catch (e) {
    if (e instanceof HttpError) return e.status;
    throw e;
  }
}

describe("families.requireRole (db)", () => {
  it("non member gets 404", async () => {
    await withTestDb(async ({ db, sql }) => {
      const t = await buildTestApp({ db, sql });
      const s = await setup(t);
      expect(await status(requireRole(db, s.familyId, s.strangerId, "viewer"))).toBe(404);
      await t.close();
    });
  });

  it("viewer fails a member route with 403", async () => {
    await withTestDb(async ({ db, sql }) => {
      const t = await buildTestApp({ db, sql });
      const s = await setup(t);
      expect(await status(requireRole(db, s.familyId, s.viewerId, "member"))).toBe(403);
      await t.close();
    });
  });

  it("member passes member route", async () => {
    await withTestDb(async ({ db, sql }) => {
      const t = await buildTestApp({ db, sql });
      const s = await setup(t);
      const res = await requireRole(db, s.familyId, s.ownerId, "member");
      expect(res.role).toBe("owner");
      expect(res.family).toEqual({ id: s.familyId, name: "রহিম পরিবার", role: "owner" });
      await t.close();
    });
  });

  it("write flag on active family passes", async () => {
    await withTestDb(async ({ db, sql }) => {
      const t = await buildTestApp({ db, sql });
      const s = await setup(t);
      const res = await requireRole(db, s.familyId, s.ownerId, "member", { write: true });
      expect(res.role).toBe("owner");
      await t.close();
    });
  });
});
