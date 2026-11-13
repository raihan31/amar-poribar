import { and, eq, isNull, lt } from "drizzle-orm";
import type { Db } from "../../../platform/db.js";
import type { SessionRepo } from "../app/ports.js";
import { sessions } from "../schema.js";

export function createSessionRepo(db: Db): SessionRepo {
  return {
    async insert(s) {
      await db.insert(sessions).values({ ...s, createdAt: s.now, lastUsedAt: s.now });
    },
    async findById(id) {
      const [row] = await db.select().from(sessions).where(eq(sessions.id, id)).limit(1);
      return row ?? null;
    },
    async rotate(oldId, child, now) {
      return db.transaction(async (tx) => {
        const marked = await tx
          .update(sessions)
          .set({ rotatedAt: now, lastUsedAt: now })
          .where(and(eq(sessions.id, oldId), isNull(sessions.rotatedAt), isNull(sessions.revokedAt)))
          .returning({ id: sessions.id });
        if (marked.length === 0) return false;
        await tx.insert(sessions).values({ ...child, createdAt: now, lastUsedAt: now });
        return true;
      });
    },
    async revokeChain(chainId, reason, now) {
      const rows = await db
        .update(sessions)
        .set({ revokedAt: now, revokedReason: reason })
        .where(and(eq(sessions.chainId, chainId), isNull(sessions.revokedAt)))
        .returning({ id: sessions.id });
      return rows.map((r) => r.id);
    },
    async revokeAllForUser(userId, reason, now) {
      const rows = await db
        .update(sessions)
        .set({ revokedAt: now, revokedReason: reason })
        .where(and(eq(sessions.userId, userId), isNull(sessions.revokedAt)))
        .returning({ id: sessions.id });
      return rows.map((r) => r.id);
    },
    async isRevoked(id, now) {
      const [row] = await db
        .select({ revokedAt: sessions.revokedAt, expiresAt: sessions.expiresAt })
        .from(sessions)
        .where(eq(sessions.id, id))
        .limit(1);
      return !row || row.revokedAt !== null || row.expiresAt < now;
    },
    async purgeExpiredBefore(cutoff) {
      const rows = await db.delete(sessions).where(lt(sessions.expiresAt, cutoff)).returning({ id: sessions.id });
      return rows.length;
    },
  };
}
