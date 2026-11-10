import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { buildApp } from "./app.js";
import { CreateRecurringSchema } from "@amar-poribar/shared";
import type { Db } from "./db/client.js";
import { monthsBetween } from "./month.js";
import {
  ReceiptRequestSchema,
  CreateFestivalBudgetSchema,
  UpdateFestivalBudgetSchema,
  UpdateTransactionSchema,
  CreateAccountSchema,
  UpdateAccountSchema,
  UpdateCategorySchema,
} from "@amar-poribar/shared";

// These tests don't touch the database; DB-backed tests need `pnpm db:up` (TODO).
const app = await buildApp({ db: {} as Db, jwtSecret: "test", isProd: false });

beforeAll(() => app.ready());
afterAll(() => app.close());

describe("api", () => {
  it("reports health", async () => {
    const res = await app.inject({ method: "GET", url: "/health" });
    expect(res.json()).toEqual({ ok: true });
  });

  it("requires auth on family routes", async () => {
    const res = await app.inject({ method: "GET", url: "/v1/families/x/transactions" });
    expect(res.statusCode).toBe(401);
  });
});

describe("cors in production", () => {
  it("allows only the configured web origin", async () => {
    const prod = await buildApp({
      db: {} as Db,
      jwtSecret: "test",
      isProd: true,
      corsOrigins: ["http://localhost:3000"],
    });
    const allowed = await prod.inject({ method: "GET", url: "/health", headers: { origin: "http://localhost:3000" } });
    const other = await prod.inject({ method: "GET", url: "/health", headers: { origin: "https://evil.example" } });
    expect(allowed.headers["access-control-allow-origin"]).toBe("http://localhost:3000");
    expect(other.headers["access-control-allow-origin"]).toBeUndefined();
    await prod.close();
  });
});

describe("invites and roles", () => {
  it("requires auth to create or accept invites", async () => {
    const create = await app.inject({ method: "POST", url: "/v1/families/x/invites", payload: {} });
    const accept = await app.inject({ method: "POST", url: "/v1/invites/abc/accept" });
    expect(create.statusCode).toBe(401);
    expect(accept.statusCode).toBe(401);
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
});

describe("csv export", () => {
  it("requires auth", async () => {
    expect((await app.inject({ method: "GET", url: "/v1/families/x/reports/export.csv" })).statusCode).toBe(401);
  });
});

describe("festival budgets", () => {
  it("requires auth", async () => {
    expect((await app.inject({ method: "GET", url: "/v1/families/x/festival-budgets" })).statusCode).toBe(401);
    expect((await app.inject({ method: "POST", url: "/v1/families/x/festival-budgets", payload: {} })).statusCode).toBe(
      401,
    );
  });

  it("validates the date range", () => {
    const ok = { name: "Eid-ul-Adha", startsOn: "2027-05-20", endsOn: "2027-05-30", limitPaisa: 5_000_000 };
    expect(CreateFestivalBudgetSchema.safeParse(ok).success).toBe(true);
    expect(CreateFestivalBudgetSchema.safeParse({ ...ok, endsOn: "2027-05-19" }).success).toBe(false);
    expect(CreateFestivalBudgetSchema.safeParse({ ...ok, limitPaisa: 0 }).success).toBe(false);
    expect(UpdateFestivalBudgetSchema.safeParse({}).success).toBe(false);
  });
});

describe("recurring entries", () => {
  it("requires auth", async () => {
    expect((await app.inject({ method: "GET", url: "/v1/families/x/recurring/drafts" })).statusCode).toBe(401);
    expect((await app.inject({ method: "POST", url: "/v1/families/x/recurring/y/confirm" })).statusCode).toBe(401);
  });

  it("validates templates", () => {
    const ok = { name: "House rent", amountPaisa: 1_200_000, dayOfMonth: 5, startsOn: "2026-01-01" };
    expect(CreateRecurringSchema.safeParse(ok).success).toBe(true);
    expect(CreateRecurringSchema.safeParse({ ...ok, dayOfMonth: 32 }).success).toBe(false);
    expect(CreateRecurringSchema.safeParse({ ...ok, endsOn: "2025-12-31" }).success).toBe(false);
  });
});

describe("remittance report", () => {
  it("requires auth", async () => {
    expect((await app.inject({ method: "GET", url: "/v1/families/x/reports/remittances" })).statusCode).toBe(401);
  });

  it("lists months across a year boundary", () => {
    expect(monthsBetween("2026-11", "2027-02")).toEqual(["2026-11", "2026-12", "2027-01", "2027-02"]);
    expect(monthsBetween("2026-05", "2026-05")).toEqual(["2026-05"]);
    expect(monthsBetween("2026-06", "2026-05")).toEqual([]);
  });
});

describe("ask", () => {
  it("requires auth", async () => {
    const res = await app.inject({ method: "POST", url: "/v1/families/x/ai/ask", payload: { question: "hi" } });
    expect(res.statusCode).toBe(401);
  });
});

describe("receipt", () => {
  it("requires auth", async () => {
    const res = await app.inject({ method: "POST", url: "/v1/families/x/ai/receipt", payload: {} });
    expect(res.statusCode).toBe(401);
  });

  it("accepts only supported, reasonably sized base64 images", () => {
    const b64 = "A".repeat(200);
    expect(ReceiptRequestSchema.safeParse({ mediaType: "image/jpeg", imageBase64: b64 }).success).toBe(true);
    expect(ReceiptRequestSchema.safeParse({ mediaType: "image/gif", imageBase64: b64 }).success).toBe(false);
    expect(ReceiptRequestSchema.safeParse({ mediaType: "image/png", imageBase64: "not base64!" + b64 }).success).toBe(
      false,
    );
    expect(ReceiptRequestSchema.safeParse({ mediaType: "image/png", imageBase64: "A".repeat(7_000_001) }).success).toBe(
      false,
    );
  });
});
