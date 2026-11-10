import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import Fastify, { type FastifyInstance } from "fastify";
import { buildApp, type AppDeps } from "./app.js";
import { loadConfig, type Config } from "./platform/config.js";
import { createDb } from "./platform/db.js";
import { runMigrations } from "./platform/migrate.js";

export interface RunningServer {
  config: Config;
  /** Port the HTTP API listens on; undefined for ROLE=worker, which serves only `/health` on `workerPort`. */
  apiPort: number | undefined;
  /** Port of the worker's tiny `/health` server; undefined unless ROLE=worker. */
  healthPort: number | undefined;
  /** Closes the HTTP server, the websocket hub, the jobs, the outbox loop and the database pool. */
  close(): Promise<void>;
}

/** `loadConfig` → `createDb` → `runMigrations` → `buildApp` → `listen`, honouring `ROLE`. */
export async function start(config: Config, deps: AppDeps = {}): Promise<RunningServer> {
  const { db, sql, close: closeDb } = createDb(config);
  try {
    if (config.migrateOnStart) await runMigrations(sql);
    const app = await buildApp({
      config,
      db,
      deps: { sql, outboxLoop: config.role !== "api", ...deps },
    });
    let health: FastifyInstance | undefined;
    let apiPort: number | undefined;
    let healthPort: number | undefined;
    try {
      if (config.role === "worker") {
        // Jobs and the outbox drainer start with `ready`; the only HTTP surface is a liveness probe.
        await app.ready();
        health = Fastify({ logger: false });
        health.get("/health", async () => ({ ok: true, role: "worker" }));
        await health.listen({ port: config.workerPort, host: "0.0.0.0" });
        healthPort = (health.server.address() as { port: number }).port;
        app.log.info(`Amar Poribar worker health on :${healthPort}`);
      } else {
        await app.listen({ port: config.port, host: "0.0.0.0" });
        apiPort = (app.server.address() as { port: number }).port;
        app.log.info(`Amar Poribar API on http://localhost:${apiPort}`);
      }
    } catch (err) {
      await health?.close();
      await app.close();
      throw err;
    }
    let closing: Promise<void> | undefined;
    return {
      config,
      apiPort,
      healthPort,
      close() {
        closing ??= (async () => {
          await health?.close();
          await app.close();
          await closeDb();
        })();
        return closing;
      },
    };
  } catch (err) {
    await closeDb();
    throw err;
  }
}

/** Closes the server on SIGTERM/SIGINT, then calls `exit`. Returns a function that removes the handlers. */
export function handleSignals(
  server: Pick<RunningServer, "close">,
  exit: (code: number) => void = (code) => process.exit(code),
  proc: Pick<NodeJS.Process, "on" | "off"> = process,
): () => void {
  let closing: Promise<void> | undefined;
  const onSignal = () => {
    closing ??= server.close().then(
      () => exit(0),
      (err: unknown) => {
        console.error("shutdown failed", err);
        exit(1);
      },
    );
  };
  proc.on("SIGTERM", onSignal);
  proc.on("SIGINT", onSignal);
  return () => {
    proc.off("SIGTERM", onSignal);
    proc.off("SIGINT", onSignal);
  };
}

/** Entry shared by `server.ts` and `worker.ts`. */
export async function main(overrides: Record<string, string> = {}): Promise<RunningServer> {
  const server = await start(loadConfig(undefined, overrides));
  handleSignals(server);
  return server;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) await main();
