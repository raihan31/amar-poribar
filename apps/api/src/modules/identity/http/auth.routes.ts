import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { BdPhoneSchema } from "@amar-poribar/shared";
import { parseOr400 } from "../../../platform/errors.js";
import { refreshTokens } from "../app/refresh.js";
import { requestOtp } from "../app/request-otp.js";
import type { OtpStore, TokenService, UserRepo } from "../app/ports.js";
import { verifyOtp } from "../app/verify-otp.js";

const VerifySchema = z.object({ phone: BdPhoneSchema, code: z.string().regex(/^\d{6}$/) });

export interface AuthRouteDeps {
  otp: OtpStore;
  users: UserRepo;
  tokens: TokenService;
  isProd: boolean;
}

export function authRoutes(app: FastifyInstance, deps: AuthRouteDeps) {
  app.post("/v1/auth/otp/request", async (req) => {
    const { phone } = parseOr400(z.object({ phone: BdPhoneSchema }), req.body);
    return requestOtp(deps, phone);
  });

  app.post("/v1/auth/otp/verify", async (req) => verifyOtp(deps, parseOr400(VerifySchema, req.body)));

  app.post("/v1/auth/refresh", async (req) => {
    const { refreshToken } = parseOr400(z.object({ refreshToken: z.string() }), req.body);
    return refreshTokens(deps.tokens, refreshToken);
  });
}
