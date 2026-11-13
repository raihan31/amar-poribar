import { lt } from "drizzle-orm";
import type { Db } from "../../../platform/db.js";
import type { Tx } from "../../../platform/events/bus.js";
import { budgetAlerts } from "../schema.js";

export const alertsRepo = {
  /** Returns true only when this call inserted the row (the threshold had not fired this month). */
  async insertIfNew(tx: Tx, v: typeof budgetAlerts.$inferInsert): Promise<boolean> {
    const rows = await tx.insert(budgetAlerts).values(v).onConflictDoNothing().returning({ id: budgetAlerts.id });
    return rows.length > 0;
  },

  async purgeOlderThan(db: Db, cutoff: Date): Promise<number> {
    const rows = await db
      .delete(budgetAlerts)
      .where(lt(budgetAlerts.firedAt, cutoff))
      .returning({ id: budgetAlerts.id });
    return rows.length;
  },
};
