import { randomBytes } from "node:crypto";
import { and, eq, isNull } from "drizzle-orm";
import type { FastifyInstance } from "fastify";
import { z } from "zod";
import {
  CreateAccountSchema,
  CreateCategorySchema,
  UpdateAccountSchema,
  UpdateCategorySchema,
} from "@amar-poribar/shared";
import type { AppDeps } from "../deps.js";
import { findMemberRole, requireRole } from "../auth.js";
import { accounts, categories } from "../db/schema.js";
import { HttpError, parseOr400 } from "../errors.js";

type FamilyParams = { Params: { familyId: string } };
type AccountParams = { Params: { familyId: string; accountId: string } };
type CategoryParams = { Params: { familyId: string; categoryId: string } };

const AccountListQuery = z.object({ includeArchived: z.stringbool().default(false) });

export async function familyRoutes(app: FastifyInstance, { db }: AppDeps) {
  app.addHook("preHandler", app.authenticate);

  app.get<FamilyParams>("/v1/families/:familyId/categories", async (req) => {
    await requireRole(db, req.params.familyId, req.user.sub, "viewer");
    return db.select().from(categories).where(eq(categories.familyId, req.params.familyId));
  });

  app.get<FamilyParams>("/v1/families/:familyId/accounts", async (req) => {
    await requireRole(db, req.params.familyId, req.user.sub, "viewer");
    const { includeArchived } = parseOr400(AccountListQuery, req.query);
    return db
      .select()
      .from(accounts)
      .where(
        includeArchived
          ? eq(accounts.familyId, req.params.familyId)
          : and(eq(accounts.familyId, req.params.familyId), isNull(accounts.archivedAt)),
      );
  });

  /** An account owner must belong to the same family (FR-ACC-02). */
  async function assertMember(familyId: string, userId: string | null | undefined) {
    if (!userId) return;
    const m = await findMemberRole(db, familyId, userId);
    if (!m) throw new HttpError(400, "invalid_request", "Account owner must be a family member");
  }

  // FR-ACC-01 / FR-ACC-02
  app.post<FamilyParams>("/v1/families/:familyId/accounts", async (req, reply) => {
    await requireRole(db, req.params.familyId, req.user.sub, "admin");
    const body = parseOr400(CreateAccountSchema, req.body);
    await assertMember(req.params.familyId, body.ownerUserId);
    const [row] = await db
      .insert(accounts)
      .values({ ...body, ownerUserId: body.ownerUserId ?? null, familyId: req.params.familyId })
      .returning();
    return reply.status(201).send(row);
  });

  app.patch<AccountParams>("/v1/families/:familyId/accounts/:accountId", async (req) => {
    await requireRole(db, req.params.familyId, req.user.sub, "admin");
    const { archived, ...rest } = parseOr400(UpdateAccountSchema, req.body);
    await assertMember(req.params.familyId, rest.ownerUserId);
    const set = {
      ...rest,
      ...(archived === undefined ? {} : { archivedAt: archived ? new Date() : null }),
      updatedAt: new Date(),
    };
    const [row] = await db
      .update(accounts)
      .set(set)
      .where(and(eq(accounts.id, req.params.accountId), eq(accounts.familyId, req.params.familyId)))
      .returning();
    if (!row) throw new HttpError(404, "not_found", "Account not found");
    return row;
  });

  // FR-CAT-02: add, rename, hide and choose an icon.
  app.post<FamilyParams>("/v1/families/:familyId/categories", async (req, reply) => {
    await requireRole(db, req.params.familyId, req.user.sub, "admin");
    const body = parseOr400(CreateCategorySchema, req.body);
    const [row] = await db
      .insert(categories)
      .values({ ...body, key: `custom_${randomBytes(6).toString("hex")}`, familyId: req.params.familyId })
      .returning();
    return reply.status(201).send(row);
  });

  app.patch<CategoryParams>("/v1/families/:familyId/categories/:categoryId", async (req) => {
    await requireRole(db, req.params.familyId, req.user.sub, "admin");
    const body = parseOr400(UpdateCategorySchema, req.body);
    const [row] = await db
      .update(categories)
      .set(body)
      .where(and(eq(categories.id, req.params.categoryId), eq(categories.familyId, req.params.familyId)))
      .returning();
    if (!row) throw new HttpError(404, "not_found", "Category not found");
    return row;
  });
}
