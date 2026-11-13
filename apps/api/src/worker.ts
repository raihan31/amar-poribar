import { main } from "./server.js";

/** Same bootstrap as `server.ts` with `ROLE=worker`: runs jobs and the outbox drainer, serves only `/health` on `WORKER_PORT` (4001). */
await main({ ROLE: "worker" });
