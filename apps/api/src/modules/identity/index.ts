import { HttpError } from "../../platform/errors.js";
import type { ModuleContext, ModuleDefinition } from "../../platform/module.js";
import type { UserBasics } from "./app/ports.js";
import { authRoutes } from "./http/auth.routes.js";
import { MemoryOtpStore } from "./infra/otp-store.memory.js";
import { registerJwt } from "./infra/jwt.js";
import { createUserRepo } from "./infra/users.repo.js";
export * from "./events.js";

export type { UserBasics };

/** Public surface of the identity module. Other modules may import only this file (SRS R1). */
export interface IdentityFacade {
  readonly name: "identity";
  getUserBasics(userId: string): Promise<UserBasics | null>;
  findUserByPhone(phone: string): Promise<{ id: string } | null>;
  getUsersBasics(ids: readonly string[]): Promise<Map<string, { id: string; name: string | null }>>;
  /** Throws `HttpError` 401 for an invalid, expired or non-access token (used by the WebSocket hub). */
  verifyAccessToken(token: string): { userId: string };
  /** Used only inside identity. */
  createUserIfMissing(phone: string): Promise<{ id: string }>;
}

declare module "../../platform/module.js" {
  interface Facades {
    identity: IdentityFacade;
  }
}

/** The part of `ModuleContext.config` identity needs, until the typed config lands (T-PLAT-31). */
export interface IdentityConfig {
  jwtSecret: string;
  isProd: boolean;
}

function identityConfig(ctx: ModuleContext): IdentityConfig {
  const c = ctx.config as Partial<IdentityConfig> | undefined;
  if (!c?.jwtSecret) throw new Error("identity: ctx.config.jwtSecret is required");
  return { jwtSecret: c.jwtSecret, isProd: c.isProd === true };
}

export const identityModule: ModuleDefinition<IdentityFacade> = {
  name: "identity",
  dependsOn: [],
  async register(app, ctx) {
    const config = identityConfig(ctx);
    const tokens = await registerJwt(app, config.jwtSecret);
    const users = createUserRepo(ctx.db);
    // The real DB-backed store arrives in T-ID-01.
    authRoutes(app, { otp: new MemoryOtpStore(), users, tokens, isProd: config.isProd });
    return {
      name: "identity",
      getUserBasics: (id) => users.getBasics(id),
      findUserByPhone: (phone) => users.findByPhone(phone),
      getUsersBasics: (ids) => users.getManyNames(ids),
      verifyAccessToken(token) {
        let payload;
        try {
          payload = tokens.verify(token);
        } catch {
          throw new HttpError(401, "unauthorized", "Missing or invalid token");
        }
        if (payload.typ !== "access") throw new HttpError(401, "unauthorized", "Access token required");
        return { userId: payload.sub };
      },
      createUserIfMissing: (phone) => users.upsertByPhone(phone),
    };
  },
};
