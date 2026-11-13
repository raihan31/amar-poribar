import type { Role } from "@amar-poribar/shared";
import type { Db } from "../../../platform/db.js";
import type { IdentityFacade } from "../../identity/index.js";
import { familiesRepo } from "../infra/families.repo.js";
import { memberRepo } from "../infra/member-repo.js";

/** What staff may see about a family: counts, masked phones, plan and status. Never money, notes or chat (DEC-18). */
export interface FamilySummaryRow {
  familyId: string;
  name: string;
  memberCount: number;
  ownerPhoneMasked: string | null;
  plan: string;
  status: string;
  createdAt: Date;
  lastActiveAt: Date | null;
  noOwner: boolean;
}

export interface FamilyAggregate {
  familyId: string;
  name: string;
  status: string;
  members: { userId: string; displayName: string; role: Role; phoneMasked: string | null }[];
  createdAt: Date;
}

export interface FamilySummaryPage {
  rows: FamilySummaryRow[];
  nextCursor: string | null;
}

export interface ListFamilySummariesInput {
  query?: string | undefined;
  status?: string | undefined;
  plan?: string | undefined;
  cursor?: string | undefined;
  limit?: number | undefined;
}

export interface AggregatesDeps {
  db: Db;
  identity: Pick<IdentityFacade, "getUserBasics" | "maskPhone">;
  /** `ledger.getLastActivity`, bound at registration; `null` until ledger binds it. */
  lastActivity: (familyId: string) => Promise<Date | null>;
}

const DEFAULT_LIMIT = 25;
const MAX_LIMIT = 100;

function encodeCursor(createdAt: Date, id: string): string {
  return Buffer.from(`${createdAt.toISOString()}|${id}`).toString("base64url");
}

function decodeCursor(cursor: string): { createdAt: Date; id: string } | undefined {
  const [iso, id] = Buffer.from(cursor, "base64url").toString().split("|");
  const createdAt = new Date(iso ?? "");
  return id && !Number.isNaN(createdAt.getTime()) ? { createdAt, id } : undefined;
}

export function createAggregates(deps: AggregatesDeps) {
  const { db, identity } = deps;

  async function ownerPhones(ownerIds: Map<string, string>): Promise<Map<string, string | null>> {
    const out = new Map<string, string | null>();
    await Promise.all(
      [...ownerIds].map(async ([familyId, userId]) => {
        const u = await identity.getUserBasics(userId);
        out.set(familyId, u?.phone ? identity.maskPhone(u.phone) : null);
      }),
    );
    return out;
  }

  async function summarise(
    rows: { id: string; name: string; plan: string; status: string; createdAt: Date }[],
  ): Promise<FamilySummaryRow[]> {
    const ids = rows.map((r) => r.id);
    const [counts, owners] = await Promise.all([familiesRepo.memberCounts(db, ids), familiesRepo.ownerIds(db, ids)]);
    const [phones, active] = await Promise.all([
      ownerPhones(owners),
      Promise.all(ids.map(async (id) => [id, await deps.lastActivity(id)] as const)),
    ]);
    const lastActive = new Map(active);
    return rows.map((r) => ({
      familyId: r.id,
      name: r.name,
      memberCount: counts.get(r.id) ?? 0,
      ownerPhoneMasked: phones.get(r.id) ?? null,
      plan: r.plan,
      status: r.status,
      createdAt: r.createdAt,
      lastActiveAt: lastActive.get(r.id) ?? null,
      noOwner: !owners.has(r.id),
    }));
  }

  return {
    async listFamilySummaries(input: ListFamilySummariesInput): Promise<FamilySummaryPage> {
      const limit = Math.min(Math.max(input.limit ?? DEFAULT_LIMIT, 1), MAX_LIMIT);
      const found = await familiesRepo.listForStaff(db, {
        query: input.query?.trim() || undefined,
        status: input.status,
        plan: input.plan,
        cursor: input.cursor ? decodeCursor(input.cursor) : undefined,
        limit: limit + 1,
      });
      const page = found.slice(0, limit);
      const last = page[page.length - 1];
      return {
        rows: await summarise(page),
        nextCursor: found.length > limit && last ? encodeCursor(last.createdAt, last.id) : null,
      };
    },

    async getFamilyAggregate(familyId: string): Promise<FamilyAggregate | null> {
      const family = await familiesRepo.familyById(db, familyId);
      if (!family) return null;
      const members = await memberRepo.listMembersWithJoined(db, familyId);
      const users = await Promise.all(members.map((m) => identity.getUserBasics(m.userId)));
      return {
        familyId: family.id,
        name: family.name,
        status: family.status,
        members: members.map((m, i) => {
          const u = users[i];
          const phoneMasked = u?.phone ? identity.maskPhone(u.phone) : null;
          return { userId: m.userId, displayName: u?.name ?? phoneMasked ?? "", role: m.role, phoneMasked };
        }),
        createdAt: family.createdAt,
      };
    },

    countFamilies: () => familiesRepo.countFamilies(db),

    async listFamiliesWithoutOwner(): Promise<FamilySummaryRow[]> {
      return summarise(await familiesRepo.withoutOwner(db));
    },
  };
}

export type Aggregates = ReturnType<typeof createAggregates>;
