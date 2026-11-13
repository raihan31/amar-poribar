import { EventEmitter } from "node:events";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { handleSignals, start } from "../src/server.js";
import { loadConfig } from "../src/platform/config.js";
import { createTestDb, type OwnedTestDb } from "./support/db-test.js";

let dbs: OwnedTestDb;
beforeAll(async () => {
  dbs = await createTestDb();
});
afterAll(() => dbs.drop());

const config = (role: "api" | "worker" | "all") =>
  loadConfig({
    NODE_ENV: "test",
    DATABASE_URL: dbs.url,
    JWT_SECRET: "test-secret",
    LOG_LEVEL: "silent",
    ROLE: role,
    PORT: "0",
    WORKER_PORT: "0",
    MIGRATE_ON_START: "true",
  });

const connections = async () => {
  const rows = await dbs.sql<{ n: number }[]>`
    select count(*)::int as n from pg_stat_activity
    where datname = current_database() and pid <> pg_backend_pid()`;
  // The test's own pool keeps some connections; the server's are counted by difference.
  return rows[0]!.n;
};

const within = <T>(p: Promise<T>, ms: number, what: string): Promise<T> =>
  Promise.race([p, new Promise<never>((_, rej) => setTimeout(() => rej(new Error(`${what} hung`)), ms))]);

describe("server bootstrap", () => {
  it("server boots with ROLE=worker and does not listen", async () => {
    const server = await start(config("worker"));
    try {
      expect(server.apiPort).toBeUndefined();
      expect(server.healthPort).toBeGreaterThan(0);
      const health = await fetch(`http://127.0.0.1:${server.healthPort}/health`);
      expect(health.status).toBe(200);
      // The worker serves nothing but its probe.
      expect((await fetch(`http://127.0.0.1:${server.healthPort}/v1/flags`)).status).toBe(404);
    } finally {
      await server.close();
    }
  });

  it("server with ROLE=api listens, runs migrations and is ready", async () => {
    const server = await start(config("api"));
    try {
      expect(server.healthPort).toBeUndefined();
      expect((await fetch(`http://127.0.0.1:${server.apiPort}/ready`)).status).toBe(200);
      expect((await fetch(`http://127.0.0.1:${server.apiPort}/v1/flags`)).status).toBe(200);
    } finally {
      await server.close();
    }
  });

  it("SIGTERM closes cleanly", async () => {
    const server = await start(config("all"));
    const proc = new EventEmitter();
    const exited = new Promise<number>((resolve) => handleSignals(server, resolve, proc as never));
    const url = `http://127.0.0.1:${server.apiPort}/health`;
    expect((await fetch(url)).status).toBe(200);
    proc.emit("SIGTERM");
    expect(await within(exited, 15_000, "shutdown")).toBe(0);
    await expect(fetch(url)).rejects.toThrow();
  });

  it("closing releases the websocket hub, the jobs and the pool without hanging", async () => {
    const before = await connections();
    const server = await start(config("all"));
    expect(await connections()).toBeGreaterThan(before);
    await within(server.close(), 15_000, "close");
    expect(await connections()).toBe(before);
  });
});
