import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";

export interface DbConfig {
  databaseUrl: string;
  dbPoolMax?: number;
}

export function createDb(config: DbConfig) {
  const sql = postgres(config.databaseUrl, { max: config.dbPoolMax ?? 10, onnotice: () => {} });
  const db = drizzle(sql);
  return { db, sql, close: () => sql.end({ timeout: 5 }) };
}

export type Db = ReturnType<typeof createDb>["db"];
export type Sql = ReturnType<typeof createDb>["sql"];
