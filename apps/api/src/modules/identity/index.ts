import { HttpError } from "../../platform/errors.js";
import type { ModuleContext, ModuleDefinition } from "../../platform/module.js";
import type { UserBasics } from "./app/ports.js";
import { registerIdentityRoutes } from "./http/routes.js";
import { devSmsRoutes, smsWebhookRoutes } from "./http/sms-routes.js";
import { createSmsDeliveryRepo } from "./infra/sms-delivery-repo.js";
import { FakeSmsGateway } from "./infra/sms/sms-fake.js";
import { createSmsGateway, type SmsConfig } from "./infra/sms/sms-factory.js";
import { AlphaSmsGateway } from "./infra/sms/sms-alpha.js";
import { SslWirelessGateway } from "./infra/sms/sms-sslwireless.js";
import * as q from "./app/get-user.js";
import { maskPhone } from "./domain/phone.js";
import { createOtpService } from "./app/otp-service.js";
import { createOtpRepo } from "./infra/otp-repo.js";
import { deviceRoutes } from "./http/device-routes.js";
import { createDeviceRepo, type DeviceToken } from "./infra/device-repo.js";
import { purgeDevicesJob, purgeOtpJob, purgeSessionsJob } from "./jobs.js";
import { createSessionService } from "./app/session-service.js";
import { createSessionRepo } from "./infra/session-repo.js";
import { registerAuthenticate } from "./http/authenticate.js";
import { registerJwt } from "./infra/jwt.js";
import { createUserRepo } from "./infra/user-repo.js";
export * from "./events.js";

export type { UserBasics };
export type { UserId, UserSummary, UserWithPhone } from "./app/get-user.js";
export type { DeviceToken };
export { maskPhone };

/** Public surface of the identity module. Other modules may import only this file (SRS R1). */
export interface IdentityFacade {
  readonly name: "identity";
  getUserBasics(userId: string): Promise<UserBasics | null>;
  getUser(id: q.UserId): Promise<q.UserSummary | null>;
  getUsers(ids: readonly q.UserId[]): Promise<Map<string, q.UserSummary>>;
  getUserWithPhone(id: q.UserId): Promise<q.UserWithPhone | null>;
  findUserByPhone(phone: string): Promise<q.UserWithPhone | null>;
  /** Throws `HttpError(401, "unauthorized")` when the user is missing or erased. */
  requireUser(id: q.UserId): Promise<q.UserSummary>;
  maskPhone(phone: string): string;
  /**
   * Whether the user accepted `policyVersion`. The consents table arrives with T-ID-08; until then nobody
   * has accepted anything, so this is false and `GET /v1/me` reports `needsAcceptance: true`.
   */
  hasAcceptedCurrentPolicy(userId: string, policyVersion: string): Promise<boolean>;
  getUsersBasics(ids: readonly string[]): Promise<Map<string, { id: string; name: string | null }>>;
  /** Throws `HttpError` 401 for an invalid, expired or non-access token (used by the WebSocket hub). */
  verifyAccessToken(token: string): { userId: string };
  /** Push tokens of the users' devices; rows without a token are skipped (FR-NOTIF-07). */
  listDeviceTokens(userIds: readonly string[]): Promise<DeviceToken[]>;
  /** Clears a token FCM reported invalid. */
  removeToken(token: string): Promise<void>;
  /** Marks a device as seen now (used by the WebSocket hub). */
  touchDevice(userId: string, deviceId: string): Promise<void>;
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
  otpPepper: string;
  isProd: boolean;
}

function smsConfig(ctx: ModuleContext): SmsConfig & { smsWebhookSecret: string | undefined } {
  const c = (ctx.config ?? {}) as Partial<SmsConfig> & { smsWebhookSecret?: string };
  return {
    isProd: c.isProd === true,
    smsGateway: c.smsGateway ?? "fake",
    smsSenderId: c.smsSenderId,
    sslwirelessApiToken: c.sslwirelessApiToken,
    sslwirelessSid: c.sslwirelessSid,
    alphaSmsApiKey: c.alphaSmsApiKey,
    smsWebhookSecret: c.smsWebhookSecret,
  };
}

function identityConfig(ctx: ModuleContext): IdentityConfig {
  const c = ctx.config as Partial<IdentityConfig> | undefined;
  if (!c?.jwtSecret) throw new Error("identity: ctx.config.jwtSecret is required");
  if (!c.otpPepper) throw new Error("identity: ctx.config.otpPepper is required");
  return { jwtSecret: c.jwtSecret, otpPepper: c.otpPepper, isProd: c.isProd === true };
}

export const identityModule: ModuleDefinition<IdentityFacade> = {
  name: "identity",
  dependsOn: [],
  async register(app, ctx) {
    const config = identityConfig(ctx);
    const tokens = await registerJwt(app, config.jwtSecret);
    const users = createUserRepo(ctx.db);
    const otp = createOtpService({
      repo: createOtpRepo(ctx.db),
      limiter: ctx.limiter,
      clock: ctx.clock,
      pepper: config.otpPepper,
    });
    const sessions = createSessionService({ repo: createSessionRepo(ctx.db), tokens, clock: ctx.clock });
    registerAuthenticate(app, (sid) => sessions.isSessionRevoked(sid));
    ctx.jobs.register(purgeOtpJob({ db: ctx.db, clock: ctx.clock }));
    ctx.jobs.register(purgeSessionsJob({ db: ctx.db, clock: ctx.clock }));
    const devices = createDeviceRepo(ctx.db);
    ctx.jobs.register(purgeDevicesJob({ db: ctx.db, clock: ctx.clock }));
    registerIdentityRoutes(app, { otp, users, sessions, isProd: config.isProd });
    deviceRoutes(app, { devices, clock: ctx.clock });
    // SMS delivery (T-ID-03). Built here so production refuses to start with the fake or without credentials.
    const sms = smsConfig(ctx);
    const gateway = createSmsGateway(sms);
    if (!sms.isProd && gateway instanceof FakeSmsGateway) devSmsRoutes(app, gateway);
    smsWebhookRoutes(app, {
      secret: sms.smsWebhookSecret,
      repo: createSmsDeliveryRepo(ctx.db),
      gateways: {
        sslwireless: new SslWirelessGateway({ apiToken: "", sid: "" }),
        alphasms: new AlphaSmsGateway({ apiKey: "" }),
        ...(sms.isProd ? {} : { fake: new FakeSmsGateway() }),
      },
    });
    return {
      name: "identity",
      getUserBasics: (id) => users.getBasics(id),
      getUser: (id) => q.getUser(users, id),
      getUsers: (ids) => q.getUsers(users, ids),
      getUserWithPhone: (id) => q.getUserWithPhone(users, id),
      findUserByPhone: (phone) => q.findUserByPhone(users, phone),
      requireUser: (id) => q.requireUser(users, id),
      maskPhone,
      // TODO(T-ID-08): read identity.consents.
      hasAcceptedCurrentPolicy: async () => false,
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
      listDeviceTokens: (ids) => devices.listTokens(ids),
      removeToken: (token) => devices.removeToken(token),
      touchDevice: (userId, deviceId) => devices.touch(userId, deviceId, ctx.clock()),
      createUserIfMissing: (phone) => users.upsertByPhone(phone),
    };
  },
};
