import { eq } from "drizzle-orm";
import type { Db } from "../../../platform/db.js";
import { familyOverrides } from "../schema.js";

export type OverrideRow = typeof familyOverrides.$inferSelect;

export async function getOverride(db: Db, familyId: string): Promise<OverrideRow | null> {
  const rows = await db.select().from(familyOverrides).where(eq(familyOverrides.familyId, familyId)).limit(1);
  return rows[0] ?? null;
}

export async function upsertOverride(db: Db, row: Omit<OverrideRow, "setAt">, setAt: Date): Promise<void> {
  const values = { ...row, setAt };
  await db.insert(familyOverrides).values(values).onConflictDoUpdate({ target: familyOverrides.familyId, set: values });
}
