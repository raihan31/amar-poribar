import { randomBytes } from "node:crypto";
import { and, eq } from "drizzle-orm";
import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { BdPhoneSchema, RoleSchema, normalizeBdPhone } from "@amar-poribar/shared";
import type { AppDeps } from "../app.js";
import { canAssignRole, canManageMember, requireRole } from "../auth.js";
import { familyInvites, familyMembers, users } from "../db/schema.js";
import { HttpError, parseOr400 } from "../errors.js";

const INVITE_TTL_MS = 7 * 24 * 60 * 60 * 1000;

const CreateInviteSchema = z.object({
  role: RoleSchema.default("member"),
  phone: BdPhoneSchema.optional(),
});
const UpdateMemberSchema = z.object({ role: RoleSchema });

type FamilyParams = { Params: { familyId: string } };
type MemberParams = { Params: { familyId: string; userId: string } };

export async function inviteRoutes(app: FastifyInstance, { db }: AppDeps) {
  app.addHook("preHandler", app.authenticate);

  // FR-FAM-02: Owner/Admin invites by phone number or shareable link.
  app.post<FamilyParams>("/v1/families/:familyId/invites", async (req, reply) => {
    const actor = await requireRole(db, req.params.familyId, req.user.sub, "admin");
    const body = parseOr400(CreateInviteSchema, req.body ?? {});
    if (!canAssignRole(actor, body.role)) throw new HttpError(403, "forbidden", "Cannot invite with this role");
    const [invite] = await db
      .insert(familyInvites)
      .values({
        familyId: req.params.familyId,
        token: randomBytes(24).toString("base64url"),
        role: body.role,
        phone: body.phone ? normalizeBdPhone(body.phone) : null,
        createdBy: req.user.sub,
        expiresAt: new Date(Date.now() + INVITE_TTL_MS),
      })
      .returning();
    return reply.status(201).send({
      token: invite!.token,
      role: invite!.role,
      phone: invite!.phone,
      expiresAt: invite!.expiresAt,
    });
  });

  app.post<{ Params: { token: string } }>("/v1/invites/:token/accept", async (req) => {
    const [invite] = await db.select().from(familyInvites).where(eq(familyInvites.token, req.params.token));
    if (!invite || invite.acceptedAt || invite.expiresAt.getTime() < Date.now()) {
      throw new HttpError(404, "not_found", "Invite not found or expired");
    }
    const [user] = await db.select().from(users).where(eq(users.id, req.user.sub));
    if (invite.phone && user?.phone !== invite.phone) {
      throw new HttpError(403, "forbidden", "This invite is for a different phone number");
    }
    await db.transaction(async (tx) => {
      await tx
        .insert(familyMembers)
        .values({ familyId: invite.familyId, userId: req.user.sub, role: invite.role })
        .onConflictDoNothing();
      await tx
        .update(familyInvites)
        .set({ acceptedBy: req.user.sub, acceptedAt: new Date() })
        .where(eq(familyInvites.id, invite.id));
    });
    return { familyId: invite.familyId, role: invite.role };
  });

  app.get<FamilyParams>("/v1/families/:familyId/members", async (req) => {
    await requireRole(db, req.params.familyId, req.user.sub, "viewer");
    return db
      .select({ userId: familyMembers.userId, role: familyMembers.role, name: users.name, phone: users.phone })
      .from(familyMembers)
      .innerJoin(users, eq(users.id, familyMembers.userId))
      .where(eq(familyMembers.familyId, req.params.familyId));
  });

  // FR-FAM-03: change roles and remove members.
  app.patch<MemberParams>("/v1/families/:familyId/members/:userId", async (req) => {
    const actor = await requireRole(db, req.params.familyId, req.user.sub, "admin");
    const { role } = parseOr400(UpdateMemberSchema, req.body);
    const current = await memberRole(req.params.familyId, req.params.userId);
    if (!canManageMember(actor, current) || !canAssignRole(actor, role)) {
      throw new HttpError(403, "forbidden", "Insufficient role");
    }
    await db
      .update(familyMembers)
      .set({ role })
      .where(and(eq(familyMembers.familyId, req.params.familyId), eq(familyMembers.userId, req.params.userId)));
    return { userId: req.params.userId, role };
  });

  app.delete<MemberParams>("/v1/families/:familyId/members/:userId", async (req, reply) => {
    const isSelf = req.params.userId === req.user.sub;
    const actor = await requireRole(db, req.params.familyId, req.user.sub, isSelf ? "viewer" : "admin");
    const current = await memberRole(req.params.familyId, req.params.userId);
    if (current === "owner") throw new HttpError(403, "forbidden", "The owner cannot be removed");
    if (!isSelf && !canManageMember(actor, current)) throw new HttpError(403, "forbidden", "Insufficient role");
    await db
      .delete(familyMembers)
      .where(and(eq(familyMembers.familyId, req.params.familyId), eq(familyMembers.userId, req.params.userId)));
    return reply.status(204).send();
  });

  async function memberRole(familyId: string, userId: string) {
    const [row] = await db
      .select({ role: familyMembers.role })
      .from(familyMembers)
      .where(and(eq(familyMembers.familyId, familyId), eq(familyMembers.userId, userId)));
    if (!row) throw new HttpError(404, "not_found", "Member not found");
    return row.role;
  }
}
