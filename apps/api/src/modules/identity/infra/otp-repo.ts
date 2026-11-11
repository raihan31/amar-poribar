import { and, desc, eq, isNull, lt, lte, sql } from "drizzle-orm";
import type { Db } from "../../../platform/db.js";
import type { OtpRepo } from "../app/ports.js";
import { otpChallenges } from "../schema.js";

export function createOtpRepo(db: Db): OtpRepo {
  return {
    async replaceChallenge(c) {
      await db.transaction(async (tx) => {
        await tx
          .update(otpChallenges)
          .set({ consumedAt: c.now })
          .where(and(eq(otpChallenges.phoneHash, c.phoneHash), isNull(otpChallenges.consumedAt)));
        await tx.insert(otpChallenges).values({
          phoneHash: c.phoneHash,
          codeHash: c.codeHash,
          ip: c.ip,
          createdAt: c.now,
          expiresAt: c.expiresAt,
        });
      });
    },
    async findActive(phoneHash) {
      const [row] = await db
        .select()
        .from(otpChallenges)
        .where(and(eq(otpChallenges.phoneHash, phoneHash), isNull(otpChallenges.consumedAt)))
        .orderBy(desc(otpChallenges.createdAt))
        .limit(1);
      return row ?? null;
    },
    async bumpAttempts(id, max) {
      const [row] = await db
        .update(otpChallenges)
        .set({ attempts: sql`${otpChallenges.attempts} + 1` })
        .where(and(eq(otpChallenges.id, id), lt(otpChallenges.attempts, max), isNull(otpChallenges.consumedAt)))
        .returning({ attempts: otpChallenges.attempts });
      return row?.attempts ?? null;
    },
    async consume(id, now) {
      const rows = await db
        .update(otpChallenges)
        .set({ consumedAt: now })
        .where(and(eq(otpChallenges.id, id), isNull(otpChallenges.consumedAt)))
        .returning({ id: otpChallenges.id });
      return rows.length === 1;
    },
    async purgeCreatedBefore(cutoff) {
      const rows = await db
        .delete(otpChallenges)
        .where(lte(otpChallenges.createdAt, cutoff))
        .returning({ id: otpChallenges.id });
      return rows.length;
    },
  };
}
