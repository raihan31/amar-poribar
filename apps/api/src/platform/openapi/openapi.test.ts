import { spawnSync } from "node:child_process";
import { copyFileSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { z } from "zod";
import { buildApp } from "../../app.js";
import type { Db } from "../db.js";
import { testConfig } from "../../../tests/support/config.js";
import { route } from "../http/route.js";
import { apiRoot, buildOpenApiDocument } from "./build.js";
import { isPublicRoute } from "./plugin.js";

const METHODS = ["get", "post", "put", "patch", "delete"];

type Doc = {
  openapi: string;
  components: { securitySchemes: Record<string, unknown> };
  paths: Record<string, Record<string, { security?: unknown[]; "x-undocumented"?: boolean }>>;
};

const app = await buildApp({ config: testConfig({ OPENAPI_PUBLIC: "true" }), db: {} as Db });
beforeAll(() => app.ready());
afterAll(() => app.close());

function registeredRoutes(): Set<string> {
  const out = new Set<string>();
  for (const r of app.registeredRoutes) {
    const [method, url] = r.split(" ") as [string, string];
    if (METHODS.includes(method.toLowerCase())) out.add(`${method} ${url.replace(/:([A-Za-z0-9_]+)/g, "{$1}")}`);
  }
  return out;
}

describe("openapi", () => {
  it("openapi document contains all registered routes", async () => {
    const res = await app.inject({ method: "GET", url: "/v1/openapi.json" });
    expect(res.statusCode).toBe(200);
    const doc = res.json<Doc>();
    expect(doc.openapi).toBe("3.1.0");
    expect(doc.components.securitySchemes).toHaveProperty("bearerAuth");
    const documented = new Set<string>();
    for (const [path, item] of Object.entries(doc.paths)) {
      for (const m of Object.keys(item)) documented.add(`${m.toUpperCase()} ${path}`);
    }
    const registered = registeredRoutes();
    expect(registered.size).toBeGreaterThan(10);
    // The openapi route itself is hidden from the document.
    registered.delete("GET /v1/openapi.json");
    expect([...registered].filter((r) => !documented.has(r))).toEqual([]);
  });

  it("every route has a bearerAuth requirement except an allow-list (auth, health, flags, invites preview)", async () => {
    const doc = (await buildOpenApiDocument()) as Doc;
    const missing: string[] = [];
    for (const [path, item] of Object.entries(doc.paths)) {
      for (const [method, op] of Object.entries(item)) {
        const secured = JSON.stringify(op.security ?? []).includes("bearerAuth");
        if (!secured && !isPublicRoute(path)) missing.push(`${method.toUpperCase()} ${path}`);
        if (secured && isPublicRoute(path)) missing.push(`${method.toUpperCase()} ${path} (should be public)`);
      }
    }
    expect(missing).toEqual([]);
    expect(isPublicRoute("/health")).toBe(true);
    expect(isPublicRoute("/v1/auth/otp/request")).toBe(true);
    expect(isPublicRoute("/v1/families/{familyId}/transactions")).toBe(false);
  });

  it("flags routes without response schemas as x-undocumented and not the ones with schemas", async () => {
    const local = await buildApp({ config: testConfig(), db: {} as Db });
    route(
      local,
      { method: "GET", url: "/v1/zz-documented", schema: { response: { 200: z.object({ ok: z.boolean() }) } } },
      async () => ({ ok: true }),
    );
    local.get("/v1/zz-undocumented", async () => ({ ok: true }));
    await local.ready();
    const doc = local.swagger() as unknown as Doc;
    expect(doc.paths["/v1/zz-documented"]!.get!["x-undocumented"]).toBeUndefined();
    expect(doc.paths["/v1/zz-undocumented"]!.get!["x-undocumented"]).toBe(true);
    await local.close();
  });

  it("hides /v1/openapi.json in production unless OPENAPI_PUBLIC", async () => {
    const prod = await buildApp({ config: testConfig({ NODE_ENV: "production" }), db: {} as Db });
    expect((await prod.inject({ method: "GET", url: "/v1/openapi.json" })).statusCode).toBe(404);
    await prod.close();
    const pub = await buildApp({
      config: testConfig({ NODE_ENV: "production", OPENAPI_PUBLIC: "true" }),
      db: {} as Db,
    });
    expect((await pub.inject({ method: "GET", url: "/v1/openapi.json" })).statusCode).toBe(200);
    await pub.close();
  });

  it("openapi:check detects a changed schema", { timeout: 120_000 }, () => {
    const dir = mkdtempSync(join(tmpdir(), "openapi-check-"));
    try {
      copyFileSync(join(apiRoot, "openapi.json"), join(dir, "openapi.json"));
      const run = () =>
        spawnSync("pnpm", ["exec", "tsx", "scripts/build-openapi.ts", "--check", "--dir", dir], {
          cwd: apiRoot,
          encoding: "utf8",
        });
      const same = run();
      expect(same.status, same.stderr).toBe(0);

      const doc = JSON.parse(readFileSync(join(dir, "openapi.json"), "utf8")) as Doc & { info: { title: string } };
      doc.info.title = "Changed";
      writeFileSync(join(dir, "openapi.json"), JSON.stringify(doc, null, 2) + "\n");
      const changed = run();
      expect(changed.status).toBe(1);
      expect(changed.stderr).toContain("out of date");
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
