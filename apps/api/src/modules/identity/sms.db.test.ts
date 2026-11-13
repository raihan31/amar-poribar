import { describe, expect, it } from "vitest";
import { buildTestApp } from "../../../tests/support/app-test.js";
import { withTestDb } from "../../../tests/support/db-test.js";
import { createSmsDeliveryRepo } from "./infra/sms-delivery-repo.js";

describe("sms receipts (db)", () => {
  it("webhook updates delivery status", async () => {
    await withTestDb(async ({ db, sql }) => {
      const t = await buildTestApp({ db, sql });
      const repo = createSmsDeliveryRepo(db);
      await repo.record({ phoneHash: "h", provider: "fake", providerId: "p-1" });
      const hook = (payload: object, secret = "test-sms-secret") =>
        t.app.inject({
          method: "POST",
          url: "/v1/webhooks/sms/fake",
          payload,
          headers: { "x-webhook-secret": secret },
        });
      expect((await hook({ providerId: "p-1", status: "delivered" }, "bad")).statusCode).toBe(401);
      const ok = await hook({ providerId: "p-1", status: "delivered", at: "2026-01-02T03:04:05Z" });
      expect(ok.statusCode).toBe(200);
      const rows = await sql`select status, delivered_at from identity.sms_deliveries where provider_id = 'p-1'`;
      expect(rows[0]!.status).toBe("delivered");
      expect(new Date(rows[0]!.delivered_at as string).toISOString()).toBe("2026-01-02T03:04:05.000Z");
      expect((await hook({ providerId: "unknown", status: "failed" })).statusCode).toBe(200);
      expect((await hook({ nonsense: true })).statusCode).toBe(400);
      const other = await t.app.inject({
        method: "POST",
        url: "/v1/webhooks/sms/other",
        payload: {},
        headers: { "x-webhook-secret": "test-sms-secret" },
      });
      expect(other.statusCode).toBe(404);
      await t.close();
    });
  });
});
