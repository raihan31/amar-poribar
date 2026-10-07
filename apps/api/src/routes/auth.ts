import { eq } from "drizzle-orm";
import { z } from "zod";
import { BdPhoneSchema, normalizeBdPhone } from "@amar-poribar/shared";
import type { AppDeps } from "../app.js";
import { familyMembers, families, users } from "../db/schema.js";
import { HttpError, parseOr400 } from "../errors.js";
import type { FastifyInstance } from "fastify";

const VerifySchema = z.object({ phone: BdPhoneSchema, code: z.string().regex(/^\d{6}$/) });

export async function authRoutes(app: FastifyInstance, { db, otp, isProd }: AppDeps) {
  const issueTokens = (userId: string) => ({
    accessToken: app.jwt.sign({ sub: userId, typ: "access" }, { expiresIn: "15m" }),
    // TODO(P1): store refresh tokens so they can be rotated and revoked (FR-AUTH-03).
    refreshToken: app.jwt.sign({ sub: userId, typ: "refresh" }, { expiresIn: "30d" }),
  });

  app.post("/v1/auth/otp/request", async (req) => {
    const { phone } = parseOr400(z.object({ phone: BdPhoneSchema }), req.body);
    const code = otp.issue(normalizeBdPhone(phone));
    // TODO(P1): send through the SMS gateway. Outside production the code is returned for local testing.
    return isProd ? { sent: true } : { sent: true, devCode: code };
  });

  app.post("/v1/auth/otp/verify", async (req) => {
    const body = parseOr400(VerifySchema, req.body);
    const phone = normalizeBdPhone(body.phone);
    if (!otp.verify(phone, body.code)) throw new HttpError(401, "invalid_otp", "Invalid or expired code");
    const [user] = await db
      .insert(users)
      .values({ phone })
      .onConflictDoUpdate({ target: users.phone, set: { updatedAt: new Date() } })
      .returning({ id: users.id });
    return issueTokens(user!.id);
  });

  app.post("/v1/auth/refresh", async (req) => {
    const { refreshToken } = parseOr400(z.object({ refreshToken: z.string() }), req.body);
    let payload;
    try {
      payload = app.jwt.verify<{ sub: string; typ: string }>(refreshToken);
    } catch {
      throw new HttpError(401, "unauthorized", "Invalid refresh token");
    }
    if (payload.typ !== "refresh") throw new HttpError(401, "unauthorized", "Invalid refresh token");
    return issueTokens(payload.sub);
  });

  app.get("/v1/me", { preHandler: app.authenticate }, async (req) => {
    const [user] = await db.select().from(users).where(eq(users.id, req.user.sub));
    if (!user) throw new HttpError(404, "not_found", "User not found");
    const memberships = await db
      .select({ id: families.id, name: families.name, role: familyMembers.role })
      .from(familyMembers)
      .innerJoin(families, eq(families.id, familyMembers.familyId))
      .where(eq(familyMembers.userId, user.id));
    return { user, families: memberships };
  });
}
