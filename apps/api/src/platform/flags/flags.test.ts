import Fastify from "fastify";
import { serializerCompiler, validatorCompiler } from "fastify-type-provider-zod";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createDb } from "../db.js";
import { registerErrorHandler } from "../errors.js";
import { runMigrations } from "../migrate.js";
import { DbFlagStore, Flags, requireFlag, type FlagStore } from "./flags.js";
import { registerFlagRoutes } from "./routes.js";

const url = process.env.TEST_DATABASE_URL ?? process.env.DATABASE_URL;

function fakeStore(rows: Record<string, boolean>): FlagStore & { calls: number } {
  return {
    calls: 0,
    async loadAll() {
      this.calls++;
      return { ...rows };
    },
  };
}

describe("Flags", () => {
  it("env override beats database", async () => {
    const f = new Flags({ store: fakeStore({ comms_video_calls: false }), env: { comms_video_calls: true } });
    expect(await f.isOn("comms_video_calls")).toBe(true);
  });

  it("database beats default", async () => {
    const f = new Flags({ store: fakeStore({ shopping: true }) });
    expect(await f.isOn("shopping")).toBe(true);
    expect(await f.isOn("lending")).toBe(false);
    expect(await f.isOn("unknown_flag")).toBe(false);
  });

  it("cache expires", async () => {
    let t = 1000;
    const rows: Record<string, boolean> = { ask: false };
    const store = fakeStore(rows);
    const f = new Flags({ store, now: () => t });
    expect(await f.isOn("ask")).toBe(false);
    rows.ask = true;
    t += 29_000;
    expect(await f.isOn("ask")).toBe(false);
    expect(store.calls).toBe(1);
    t += 1_500;
    expect(await f.isOn("ask")).toBe(true);
    expect(store.calls).toBe(2);
  });

  it("requireFlag returns 404 when off", async () => {
    const flags = new Flags({ store: fakeStore({}), env: { comms_chat: false } });
    const app = Fastify();
    registerErrorHandler(app);
    app.get("/dark", { preHandler: requireFlag(flags, "comms_chat") }, async () => ({ ok: true }));
    const off = await app.inject("/dark");
    expect(off.statusCode).toBe(404);
    expect(off.json().error.code).toBe("not_found");

    const on = new Flags({ store: fakeStore({}), env: { comms_chat: true } });
    const app2 = Fastify();
    registerErrorHandler(app2);
    app2.get("/dark", { preHandler: requireFlag(on, "comms_chat") }, async () => ({ ok: true }));
    expect((await app2.inject("/dark")).statusCode).toBe(200);
  });

  it("GET /v1/flags lists flags with cache header", async () => {
    const app = Fastify();
    app.setValidatorCompiler(validatorCompiler);
    app.setSerializerCompiler(serializerCompiler);
    registerFlagRoutes(app, new Flags({ store: fakeStore({ shopping: true }) }));
    const res = await app.inject("/v1/flags");
    expect(res.statusCode).toBe(200);
    expect(res.headers["cache-control"]).toBe("max-age=60");
    expect(res.json().flags).toMatchObject({ shopping: true, comms_chat: false });
  });
});

describe.skipIf(!url)("DbFlagStore", () => {
  const { sql, close } = createDb({ databaseUrl: url ?? "", dbPoolMax: 6 });
  beforeAll(async () => {
    await runMigrations(sql);
  });
  afterAll(async () => {
    await sql`delete from platform.feature_flags where name = 'receipts'`;
    await close();
  });

  it("database row is read through the store and env still wins", async () => {
    await sql`insert into platform.feature_flags (name, enabled, description) values ('receipts', true, 'test')
      on conflict (name) do update set enabled = true`;
    const store = new DbFlagStore(sql);
    expect(await new Flags({ store }).isOn("receipts")).toBe(true);
    expect(await new Flags({ store, env: { receipts: false } }).isOn("receipts")).toBe(false);
  });
});
