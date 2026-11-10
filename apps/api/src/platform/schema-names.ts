/** Postgres schema names: one per module (DEC-02) plus `platform` for infrastructure tables. */
export const MODULE_SCHEMA_NAMES = [
  "identity",
  "families",
  "ledger",
  "budgeting",
  "recurring",
  "ai",
  "reporting",
  "sync",
  "comms",
  "notifications",
  "shopping",
  "lending",
  "billing",
  "privacy",
  "admin",
  "platform",
] as const;

export type SchemaName = (typeof MODULE_SCHEMA_NAMES)[number];
