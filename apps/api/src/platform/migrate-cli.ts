import { loadConfig } from "./config.js";
import { createDb } from "./db.js";
import { runMigrations } from "./migrate.js";

const config = loadConfig();
const { sql, close } = createDb({ ...config, dbPoolMax: 2 });
try {
  await runMigrations(sql);
  console.warn("migrations applied");
} finally {
  await close();
}
