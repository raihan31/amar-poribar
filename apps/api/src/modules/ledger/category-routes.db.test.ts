import { describe, expect, it } from "vitest";
import { buildTestApp } from "../../../tests/support/app-test.js";
import { withTestDb } from "../../../tests/support/db-test.js";

type Cat = { id: string; icon: string | null; nameEn: string; isHidden: boolean };

describe("category routes (db)", () => {
  it("custom category with unknown icon returns 400", async () => {
    await withTestDb(async ({ db, sql }) => {
      const t = await buildTestApp({ db, sql });
      const owner = await t.login("01711111111");
      const fam = await t.app.inject({
        method: "POST",
        url: "/v1/families",
        headers: t.as(owner),
        payload: { name: "x" },
      });
      const url = `/v1/families/${fam.json<{ id: string }>().id}/categories`;
      const bad = await t.app.inject({
        method: "POST",
        url,
        headers: t.as(owner),
        payload: { kind: "expense", nameEn: "Pets", nameBn: "পোষা", icon: "🐶" },
      });
      expect(bad.statusCode).toBe(400);
      const ok = await t.app.inject({
        method: "POST",
        url,
        headers: t.as(owner),
        payload: { kind: "expense", nameEn: "Pets", nameBn: "পোষা", icon: "heart" },
      });
      expect(ok.statusCode).toBe(201);
      expect(ok.json<Cat>().icon).toBe("heart");
      await t.close();
    });
  });

  it("hide and rename still work", async () => {
    await withTestDb(async ({ db, sql }) => {
      const t = await buildTestApp({ db, sql });
      const owner = await t.login("01711111111");
      const fam = await t.app.inject({
        method: "POST",
        url: "/v1/families",
        headers: t.as(owner),
        payload: { name: "x" },
      });
      const url = `/v1/families/${fam.json<{ id: string }>().id}/categories`;
      const list = await t.app.inject({ method: "GET", url, headers: t.as(owner) });
      const first = list.json<Cat[]>()[0]!;
      const patch = await t.app.inject({
        method: "PATCH",
        url: `${url}/${first.id}`,
        headers: t.as(owner),
        payload: { nameEn: "Renamed", isHidden: true, icon: "dots" },
      });
      expect(patch.statusCode).toBe(200);
      expect(patch.json<Cat>()).toMatchObject({ nameEn: "Renamed", isHidden: true, icon: "dots" });
      const badPatch = await t.app.inject({
        method: "PATCH",
        url: `${url}/${first.id}`,
        headers: t.as(owner),
        payload: { icon: "🐶" },
      });
      expect(badPatch.statusCode).toBe(400);
      await t.close();
    });
  });
});
