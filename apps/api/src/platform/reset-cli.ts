import { loadConfig } from "./config.js";
import { createDb } from "./db.js";
import { resetDatabase } from "./reset.js";

const config = loadConfig();
if (config.isProd) {
  console.error("db:reset refuses to run when NODE_ENV=production");
  process.exit(1);
}
const { sql, close } = createDb({ ...config, dbPoolMax: 2 });
try {
  await resetDatabase(sql, config.nodeEnv);
  console.warn("database reset and migrated");
} finally {
  await close();
}
