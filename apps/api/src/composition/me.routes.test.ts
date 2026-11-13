import Fastify from "fastify";
import { serializerCompiler, validatorCompiler } from "fastify-type-provider-zod";
import { describe, expect, it } from "vitest";
import { registerErrorHandler } from "../platform/errors.js";
import type { IdentityFacade } from "../modules/identity/index.js";
import type { FamiliesFacade } from "../modules/families/index.js";
import type { PrivacyFacade } from "../modules/privacy/index.js";
import type { ModuleContext } from "../platform/module.js";
import { meRoutes } from "./me.routes.js";

const USER = {
  id: "00000000-0000-4000-8000-0000000000a1",
  phone: "+8801700000001",
  name: "রহিম",
  locale: "bn",
  bnDigits: true,
  createdAt: new Date("2026-10-05T08:22:00.000Z"),
  updatedAt: new Date("2026-10-05T08:22:00.000Z"),
};
const FAMILY = {
  id: "00000000-0000-4000-8000-000000000001",
  name: "রহিম পরিবার",
  role: "owner",
  status: "active",
  memberLimit: 3,
  memberCount: 2,
};

async function build(user: typeof USER | null, accepted = true) {
  const app = Fastify();
  app.setValidatorCompiler(validatorCompiler);
  app.setSerializerCompiler(serializerCompiler);
  registerErrorHandler(app);
  app.decorate("authenticate", async (req: { user: { sub: string } }) => {
    req.user = { sub: USER.id };
  });
  const ctx = {
    facades: {
      identity: {
        getUserBasics: async () => user,
        hasAcceptedCurrentPolicy: async () => accepted,
      } as unknown as IdentityFacade,
      families: { listMemberships: async () => [FAMILY] } as unknown as FamiliesFacade,
      privacy: { getCurrentPolicyVersion: () => "2026-11-01" } as unknown as PrivacyFacade,
    },
  } as unknown as ModuleContext;
  meRoutes(app, ctx);
  await app.ready();
  return app;
}

describe("GET /v1/me", () => {
  it("composes the profile, the memberships and the consent state", async () => {
    const app = await build(USER);
    const res = await app.inject({ method: "GET", url: "/v1/me" });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({
      user: { ...USER, createdAt: "2026-10-05T08:22:00.000Z", updatedAt: "2026-10-05T08:22:00.000Z" },
      families: [FAMILY],
      consents: { policyVersion: "2026-11-01", needsAcceptance: false },
    });
    await app.close();
  });

  it("needsAcceptance is true when the policy was not accepted", async () => {
    const app = await build(USER, false);
    const res = await app.inject({ method: "GET", url: "/v1/me" });
    expect(res.json().consents.needsAcceptance).toBe(true);
    await app.close();
  });

  it("is 404 when the user is gone", async () => {
    const app = await build(null);
    const res = await app.inject({ method: "GET", url: "/v1/me" });
    expect(res.statusCode).toBe(404);
    await app.close();
  });
});
