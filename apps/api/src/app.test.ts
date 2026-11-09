import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { buildApp } from "./app.js";
import { budgetLevel, effectiveBudgets } from "./budgets.js";
import { canAssignRole, canManageMember } from "./auth.js";
import type { Db } from "./db/client.js";
import { monthRange } from "./month.js";
import { OtpStore } from "./otp.js";
import { UpdateTransactionSchema, CreateAccountSchema, UpdateAccountSchema, UpdateCategorySchema } from "@amar-poribar/shared";

// These tests don't touch the database; DB-backed tests need `pnpm db:up` (TODO).
const app = await buildApp({ db: {} as Db, otp: new OtpStore(), jwtSecret: "test", isProd: false });

beforeAll(() => app.ready());
afterAll(() => app.close());

describe("api", () => {
  it("reports health", async () => {
    const res = await app.inject({ method: "GET", url: "/health" });
    expect(res.json()).toEqual({ ok: true });
  });

  it("rejects non-Bangladeshi phone numbers", async () => {
    const res = await app.inject({ method: "POST", url: "/v1/auth/otp/request", payload: { phone: "12345" } });
    expect(res.statusCode).toBe(400);
    expect(res.json().error.code).toBe("invalid_request");
  });

  it("issues a dev OTP outside production", async () => {
    const res = await app.inject({ method: "POST", url: "/v1/auth/otp/request", payload: { phone: "01712345678" } });
    expect(res.json().devCode).toMatch(/^\d{6}$/);
  });

  it("requires auth on family routes", async () => {
    const res = await app.inject({ method: "GET", url: "/v1/families/x/transactions" });
    expect(res.statusCode).toBe(401);
  });
});

describe("cors in production", () => {
  it("allows only the configured web origin", async () => {
    const prod = await buildApp({
      db: {} as Db, otp: new OtpStore(), jwtSecret: "test", isProd: true, corsOrigins: ["http://localhost:3000"],
    });
    const allowed = await prod.inject({ method: "GET", url: "/health", headers: { origin: "http://localhost:3000" } });
    const other = await prod.inject({ method: "GET", url: "/health", headers: { origin: "https://evil.example" } });
    expect(allowed.headers["access-control-allow-origin"]).toBe("http://localhost:3000");
    expect(other.headers["access-control-allow-origin"]).toBeUndefined();
    await prod.close();
  });
});

describe("monthRange", () => {
  it("uses Dhaka month boundaries", () => {
    const { start, end } = monthRange("2026-12");
    expect(start.toISOString()).toBe("2026-11-30T18:00:00.000Z");
    expect(end.toISOString()).toBe("2026-12-31T18:00:00.000Z");
  });
});

describe("invites and roles", () => {
  it("requires auth to create or accept invites", async () => {
    const create = await app.inject({ method: "POST", url: "/v1/families/x/invites", payload: {} });
    const accept = await app.inject({ method: "POST", url: "/v1/invites/abc/accept" });
    expect(create.statusCode).toBe(401);
    expect(accept.statusCode).toBe(401);
  });

  it("only owners can grant admin, and nobody can grant owner", () => {
    expect(canAssignRole("owner", "admin")).toBe(true);
    expect(canAssignRole("admin", "admin")).toBe(false);
    expect(canAssignRole("admin", "member")).toBe(true);
    expect(canAssignRole("member", "viewer")).toBe(false);
    expect(canAssignRole("owner", "owner")).toBe(false);
  });

  it("protects the owner and lets only owners manage admins", () => {
    expect(canManageMember("admin", "owner")).toBe(false);
    expect(canManageMember("owner", "owner")).toBe(false);
    expect(canManageMember("admin", "admin")).toBe(false);
    expect(canManageMember("owner", "admin")).toBe(true);
    expect(canManageMember("admin", "viewer")).toBe(true);
    expect(canManageMember("member", "viewer")).toBe(false);
  });
});

describe("accounts and categories", () => {
  it("requires auth to create or edit them", async () => {
    for (const [method, url] of [
      ["POST", "/v1/families/x/accounts"],
      ["PATCH", "/v1/families/x/accounts/y"],
      ["POST", "/v1/families/x/categories"],
      ["PATCH", "/v1/families/x/categories/y"],
    ] as const) {
      const res = await app.inject({ method, url, payload: {} });
      expect(res.statusCode, `${method} ${url}`).toBe(401);
    }
  });

  it("validates account and category input", () => {
    expect(CreateAccountSchema.safeParse({ name: "bKash", type: "bkash" }).success).toBe(true);
    expect(CreateAccountSchema.safeParse({ name: "x", type: "paypal" }).success).toBe(false);
    expect(UpdateAccountSchema.safeParse({}).success).toBe(false);
    expect(UpdateAccountSchema.safeParse({ archived: true }).success).toBe(true);
    expect(UpdateCategorySchema.safeParse({ isHidden: true }).success).toBe(true);
    expect(UpdateCategorySchema.safeParse({}).success).toBe(false);
  });
});

describe("transaction updates", () => {
  it("requires auth", async () => {
    const res = await app.inject({ method: "PATCH", url: "/v1/families/x/transactions/y", payload: { note: "a" } });
    expect(res.statusCode).toBe(401);
  });

  it("accepts partial edits and rejects empty or unsafe ones", () => {
    expect(UpdateTransactionSchema.safeParse({ amountPaisa: 15000 }).success).toBe(true);
    expect(UpdateTransactionSchema.safeParse({ note: null }).success).toBe(true);
    expect(UpdateTransactionSchema.safeParse({}).success).toBe(false);
    expect(UpdateTransactionSchema.safeParse({ amountPaisa: 1.5 }).success).toBe(false);
    expect(UpdateTransactionSchema.safeParse({ amountPaisa: -5 }).success).toBe(false);
    // Defaults must not leak into partial updates (would silently zero the fee).
    expect(UpdateTransactionSchema.parse({ note: "x" })).toEqual({ note: "x" });
  });
});

describe("budgets", () => {
  it("requires auth", async () => {
    expect((await app.inject({ method: "GET", url: "/v1/families/x/budgets" })).statusCode).toBe(401);
    expect((await app.inject({ method: "PUT", url: "/v1/families/x/budgets", payload: {} })).statusCode).toBe(401);
  });

  it("alerts at 80% and 100%", () => {
    expect(budgetLevel(7999, 10000)).toBe("ok");
    expect(budgetLevel(8000, 10000)).toBe("warning");
    expect(budgetLevel(9999, 10000)).toBe("warning");
    expect(budgetLevel(10000, 10000)).toBe("exceeded");
    expect(budgetLevel(5000, 0)).toBe("ok");
  });

  it("carries last month's budgets forward unless changed or cleared", () => {
    const rows = [
      { categoryId: "bazaar", month: "2026-09", limitPaisa: 800000 },
      { categoryId: "bazaar", month: "2026-10", limitPaisa: 900000 },
      { categoryId: "rent", month: "2026-09", limitPaisa: 1500000 },
      { categoryId: "rent", month: "2026-10", limitPaisa: 0 },
      { categoryId: null, month: "2026-09", limitPaisa: 4000000 },
      { categoryId: "future", month: "2026-12", limitPaisa: 1 },
    ];
    const got = effectiveBudgets(rows, "2026-11");
    expect(got.map((b) => [b.categoryId, b.limitPaisa, b.inherited])).toEqual([
      ["bazaar", 900000, true],
      [null, 4000000, true],
    ]);
    expect(effectiveBudgets(rows, "2026-10").find((b) => b.categoryId === "bazaar")?.inherited).toBe(false);
  });
});
