import type { FastifyInstance } from "fastify";
import { z } from "zod";
import {
  OtpRequestResponseSchema,
  OtpRequestSchema,
  OtpVerifyResponseSchema,
  OtpVerifySchema,
} from "@amar-poribar/shared";
import { parseOr400 } from "../../../platform/errors.js";
import type { SmsGateway } from "../../../platform/ports/sms-gateway.js";
import { docs } from "../../../platform/http/responses.js";
import { requestOtp } from "../app/request-otp.js";
import type { OtpService } from "../app/otp-service.js";
import type { UserRepo } from "../app/ports.js";
import type { SessionService } from "../app/session-service.js";
import { verifyOtp } from "../app/verify-otp.js";

const RefreshSchema = z.object({ refreshToken: z.string(), deviceId: z.string().min(1).max(200).optional() });

export interface AuthRouteDeps {
  otp: OtpService;
  users: UserRepo;
  sessions: SessionService;
  sms: SmsGateway;
  /** True only when not in production and the SMS gateway is the fake: the code is then echoed as `devCode`. */
  exposeDevCode: boolean;
}

export function authRoutes(app: FastifyInstance, deps: AuthRouteDeps) {
  app.post("/v1/auth/otp/request", { schema: { response: { "2xx": OtpRequestResponseSchema } } }, async (req) => {
    const { phone } = parseOr400(OtpRequestSchema, req.body);
    return requestOtp(deps, phone, req.ip);
  });

  app.post("/v1/auth/otp/verify", { schema: { response: { "2xx": OtpVerifyResponseSchema } } }, async (req) =>
    verifyOtp(deps, parseOr400(OtpVerifySchema, req.body)),
  );

  app.post("/v1/auth/refresh", { schema: docs.object }, async (req) => {
    const { refreshToken, deviceId } = parseOr400(RefreshSchema, req.body);
    return deps.sessions.rotate(refreshToken, deviceId);
  });
}
