import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { BdPhoneSchema } from "@amar-poribar/shared";
import { parseOr400 } from "../../../platform/errors.js";
import { requestOtp } from "../app/request-otp.js";
import type { OtpService } from "../app/otp-service.js";
import type { UserRepo } from "../app/ports.js";
import type { SessionService } from "../app/session-service.js";
import { verifyOtp } from "../app/verify-otp.js";
import { docs } from "../../../platform/http/responses.js";

const VerifySchema = z.object({
  phone: BdPhoneSchema,
  code: z.string().regex(/^\d{6}$/),
  deviceId: z.string().min(1).max(200).optional(),
});
const RefreshSchema = z.object({ refreshToken: z.string(), deviceId: z.string().min(1).max(200).optional() });

export interface AuthRouteDeps {
  otp: OtpService;
  users: UserRepo;
  sessions: SessionService;
  isProd: boolean;
}

export function authRoutes(app: FastifyInstance, deps: AuthRouteDeps) {
  app.post("/v1/auth/otp/request", { schema: docs.object }, async (req) => {
    const { phone } = parseOr400(z.object({ phone: BdPhoneSchema }), req.body);
    return requestOtp(deps, phone, req.ip);
  });

  app.post("/v1/auth/otp/verify", { schema: docs.object }, async (req) =>
    verifyOtp(deps, parseOr400(VerifySchema, req.body)),
  );

  app.post("/v1/auth/refresh", { schema: docs.object }, async (req) => {
    const { refreshToken, deviceId } = parseOr400(RefreshSchema, req.body);
    return deps.sessions.rotate(refreshToken, deviceId);
  });
}
