import Fastify from "fastify";
import { serializerCompiler, validatorCompiler } from "fastify-type-provider-zod";
import { describe, expect, it } from "vitest";
import { withTestDb } from "../../../tests/support/db-test.js";
import { registerErrorHandler } from "../../platform/errors.js";
import type { ModuleContext } from "../../platform/module.js";
import { getCurrentPolicyVersion, privacyModule } from "./index.js";

async function build() {
  const app = Fastify();
  app.setValidatorCompiler(validatorCompiler);
  app.setSerializerCompiler(serializerCompiler);
  registerErrorHandler(app);
  // No `authenticate` decorator: the policy route must not need one.
  await privacyModule.register(app, {} as unknown as ModuleContext);
  return app;
}

describe("policy endpoint", () => {
  it("bn and en served", async () => {
    const app = await build();
    for (const locale of ["bn", "en"]) {
      const res = await app.inject({ method: "GET", url: `/v1/policy?locale=${locale}` });
      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(body.locale).toBe(locale);
      expect(body.text.length).toBeGreaterThan(200);
      expect(typeof body.updatedAt).toBe("string");
    }
    await app.close();
  });

  it("version present", async () => {
    const app = await build();
    const res = await app.inject({ method: "GET", url: "/v1/policy?locale=en" });
    expect(res.json().version).toBe("2026-11-01");
    expect(getCurrentPolicyVersion()).toBe("2026-11-01");
    await app.close();
  });

  it("unauthenticated allowed", async () => {
    const app = await build();
    const res = await app.inject({ method: "GET", url: "/v1/policy?locale=bn" });
    expect(res.statusCode).toBe(200);
    await app.close();
  });

  it("unknown locale 400", async () => {
    const app = await build();
    const res = await app.inject({ method: "GET", url: "/v1/policy?locale=fr" });
    expect(res.statusCode).toBe(400);
    await app.close();
  });

  it("requests table allows one open request per kind and user", async () => {
    await withTestDb(async ({ sql }) => {
      const user = "11111111-1111-4111-8111-111111111111";
      const ins = (kind: string) =>
        sql`insert into privacy.requests (id, user_id, kind, step, due_at)
            values (gen_random_uuid(), ${user}, ${kind}, 'identity_checked', now() + interval '30 days')`;
      await ins("erasure");
      await ins("export");
      await expect(ins("erasure")).rejects.toThrow();
      await expect(ins("bogus")).rejects.toThrow();
      await sql`update privacy.requests set status = 'cancelled' where kind = 'erasure'`;
      await ins("erasure");
    });
  });
});
