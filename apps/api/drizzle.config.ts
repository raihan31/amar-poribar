import { defineConfig } from "drizzle-kit";
import { MODULE_SCHEMA_NAMES } from "./src/platform/schema-names.js";

export default defineConfig({
  schema: [
    "./src/modules/*/schema.ts",
    "./src/platform/*/schema.ts",
    "./src/platform/events/outbox.schema.ts",
  ],
  schemaFilter: [...MODULE_SCHEMA_NAMES],
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: { url: process.env.DATABASE_URL ?? "postgres://amar:amar@localhost:5432/amar_poribar" },
});
