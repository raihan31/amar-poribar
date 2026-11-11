import { eq } from "drizzle-orm";
import type { Db } from "../../../platform/db.js";
import { smsDeliveries } from "../schema.js";

export interface SmsDeliveryRepo {
  /** Stores one row per sent message; only the phone digest is kept. */
  record(d: { phoneHash: string; provider: string; providerId: string }): Promise<void>;
  /** Applies a provider receipt. Unknown provider ids are ignored (returns false). */
  applyReceipt(r: { provider: string; providerId: string; status: "delivered" | "failed"; at: Date }): Promise<boolean>;
}

export function createSmsDeliveryRepo(db: Db): SmsDeliveryRepo {
  return {
    async record(d) {
      await db.insert(smsDeliveries).values(d);
    },
    async applyReceipt(r) {
      const rows = await db
        .update(smsDeliveries)
        .set({ status: r.status, deliveredAt: r.status === "delivered" ? r.at : null })
        .where(eq(smsDeliveries.providerId, r.providerId))
        .returning({ id: smsDeliveries.id });
      return rows.length > 0;
    },
  };
}
