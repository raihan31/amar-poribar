import { and, desc, eq } from "drizzle-orm";
import type { Db } from "../../../platform/db.js";
import { consents } from "../schema.js";

export type ConsentKind = "privacy_policy" | "voice_notes";

export interface ConsentRepo {
  /** Idempotent per (user, kind, version). */
  record(userId: string, kind: ConsentKind, version: string, locale: string, now: Date): Promise<void>;
  latestVersion(userId: string, kind: ConsentKind): Promise<string | null>;
  hasAccepted(userId: string, kind: ConsentKind, version: string): Promise<boolean>;
}

export function createConsentRepo(db: Db): ConsentRepo {
  return {
    async record(userId, kind, version, locale, now) {
      await db
        .insert(consents)
        .values({ userId, kind, version, locale, acceptedAt: now })
        .onConflictDoNothing({ target: [consents.userId, consents.kind, consents.version] });
    },
    async latestVersion(userId, kind) {
      const rows = await db
        .select({ version: consents.version })
        .from(consents)
        .where(and(eq(consents.userId, userId), eq(consents.kind, kind)))
        .orderBy(desc(consents.acceptedAt))
        .limit(1);
      return rows[0]?.version ?? null;
    },
    async hasAccepted(userId, kind, version) {
      const rows = await db
        .select({ id: consents.id })
        .from(consents)
        .where(and(eq(consents.userId, userId), eq(consents.kind, kind), eq(consents.version, version)))
        .limit(1);
      return rows.length > 0;
    },
  };
}
