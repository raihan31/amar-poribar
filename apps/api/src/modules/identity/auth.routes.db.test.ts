import { describe, expect, it } from "vitest";
import { buildTestApp } from "../../../tests/support/app-test.js";
import { withTestDb } from "../../../tests/support/db-test.js";

describe("identity auth (db)", () => {
  it("verify creates the user once and issues tokens", async () => {
    await withTestDb(async ({ db, sql }) => {
      const t = await buildTestApp({ db, sql });
      const first = await t.login("01712345678");
      const second = await t.login("01712345678");
      expect(first.accessToken).toBeTruthy();
      const rows = await sql`select id from identity.users where phone = '+8801712345678'`;
      expect(rows.length).toBe(1);
      const refreshed = await t.app.inject({
        method: "POST",
        url: "/v1/auth/refresh",
        payload: { refreshToken: second.refreshToken },
      });
      expect(refreshed.statusCode).toBe(200);
      await t.close();
    });
  });
});
