import { eq, inArray } from "drizzle-orm";
import type { Db } from "../../../platform/db.js";
import type { UserRepo } from "../app/ports.js";
import { users } from "../schema.js";

export function createUserRepo(db: Db): UserRepo {
  return {
    async upsertByPhone(phone) {
      const [row] = await db
        .insert(users)
        .values({ phone })
        .onConflictDoUpdate({ target: users.phone, set: { updatedAt: new Date() } })
        .returning({ id: users.id });
      return { id: row!.id };
    },
    async findByPhone(phone) {
      const [row] = await db.select({ id: users.id }).from(users).where(eq(users.phone, phone));
      return row ?? null;
    },
    async getBasics(userId) {
      const [row] = await db
        .select({
          id: users.id,
          name: users.name,
          phone: users.phone,
          locale: users.locale,
          bnDigits: users.bnDigits,
          createdAt: users.createdAt,
          updatedAt: users.updatedAt,
        })
        .from(users)
        .where(eq(users.id, userId));
      return row ?? null;
    },
    async getManyNames(ids) {
      if (ids.length === 0) return new Map();
      const rows = await db
        .select({ id: users.id, name: users.name })
        .from(users)
        .where(inArray(users.id, [...ids]));
      return new Map(rows.map((r) => [r.id, r]));
    },
  };
}
