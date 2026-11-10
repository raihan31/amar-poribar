import { readFileSync } from "node:fs";
import Fastify from "fastify";
import { describe, expect, it } from "vitest";
import { registerErrorHandler } from "../errors.js";
import type { IdentityFacade } from "../modules/identity/index.js";
import type { FamiliesFacade } from "../modules/families/index.js";
import type { ModuleContext } from "../platform/module.js";
import { meRoutes } from "./me.routes.js";

const vector = JSON.parse(
  readFileSync(new URL("../../../../packages/shared/test-vectors/api/me.json", import.meta.url), "utf8"),
) as { body: { user: Record<string, unknown>; families: unknown[] } };

async function build(user: Record<string, unknown> | null) {
  const app = Fastify();
  registerErrorHandler(app);
  app.decorate("authenticate", async (req: { user: { sub: string } }) => {
    req.user = { sub: String(vector.body.user.id) };
  });
  const u = user && {
    ...user,
    createdAt: new Date(String(user.createdAt)),
    updatedAt: new Date(String(user.updatedAt)),
  };
  const ctx = {
    facades: {
      identity: { getUserBasics: async () => u } as unknown as IdentityFacade,
      families: { listFamiliesForUser: async () => vector.body.families } as unknown as FamiliesFacade,
    },
  } as unknown as ModuleContext;
  meRoutes(app, ctx);
  await app.ready();
  return app;
}

describe("GET /v1/me", () => {
  it("returns exactly the stored test vector", async () => {
    const app = await build(vector.body.user);
    const res = await app.inject({ method: "GET", url: "/v1/me" });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual(vector.body);
    await app.close();
  });

  it("is 404 when the user is gone", async () => {
    const app = await build(null);
    const res = await app.inject({ method: "GET", url: "/v1/me" });
    expect(res.statusCode).toBe(404);
    await app.close();
  });
});
