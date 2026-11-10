import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "../db/schema.js";

export interface DbConfig {
  databaseUrl: string;
  dbPoolMax?: number;
}

export function createDb(config: DbConfig) {
  const sql = postgres(config.databaseUrl, { max: config.dbPoolMax ?? 10, onnotice: () => {} });
  const db = drizzle(sql, { schema });
  return { db, sql, close: () => sql.end({ timeout: 5 }) };
}

export type Db = ReturnType<typeof createDb>["db"];
export type Sql = ReturnType<typeof createDb>["sql"];
export { schema };
