import { env } from "../env.js";
import { createDb, schema } from "../platform/db.js";
export type { Db } from "../platform/db.js";

const { db, sql } = createDb(env);
export const sqlClient = sql;
export { db, schema };
