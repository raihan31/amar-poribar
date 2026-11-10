import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { buildApp } from "./app.js";
import { dueDateIn, isDueIn, reminderState } from "./recurring.js";
import { CreateRecurringSchema } from "@amar-poribar/shared";
import { csvCell, csvRow, dhakaStamp, paisaToDecimal } from "./csv.js";
import type { Db } from "./db/client.js";
import { monthsBetween } from "./month.js";
import {
  SyncRequestSchema,
  SyncTransactionSchema,
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

  it("quotes cells and blocks spreadsheet formulas", () => {
    expect(csvCell('say "hi", ok')).toBe('"say ""hi"", ok"');
    expect(csvCell("বাজার")).toBe("বাজার");
    expect(csvCell('=HYPERLINK("http://evil")')).toBe('"\'=HYPERLINK(""http://evil"")"');
    expect(csvCell("-5 note")).toBe("'-5 note");
    expect(csvCell(-500)).toBe("-500");
    expect(csvRow(["a", null, 3])).toBe("a,,3");
  });

  it("formats paisa exactly and dates in Dhaka time", () => {
    expect(paisaToDecimal(0)).toBe("0.00");
    expect(paisaToDecimal(5)).toBe("0.05");
    expect(paisaToDecimal(123456)).toBe("1234.56");
    expect(dhakaStamp(new Date("2026-11-30T18:30:00Z"))).toBe("2026-12-01 00:30");
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
  const base = {
    dayOfMonth: 5,
    startsOn: "2026-01-01",
    endsOn: null,
    active: true,
    lastConfirmedMonth: null,
    remindDaysBefore: 2,
  };

  it("requires auth", async () => {
    expect((await app.inject({ method: "GET", url: "/v1/families/x/recurring/drafts" })).statusCode).toBe(401);
    expect((await app.inject({ method: "POST", url: "/v1/families/x/recurring/y/confirm" })).statusCode).toBe(401);
  });

  it("clamps the due day to short months", () => {
    expect(dueDateIn("2026-02", 31)).toBe("2026-02-28");
    expect(dueDateIn("2028-02", 30)).toBe("2028-02-29");
    expect(dueDateIn("2026-11", 31)).toBe("2026-11-30");
    expect(dueDateIn("2026-11", 5)).toBe("2026-11-05");
  });

  it("is due once per month, within its dates and only while active", () => {
    expect(isDueIn(base, "2026-11")).toBe(true);
    expect(isDueIn({ ...base, lastConfirmedMonth: "2026-11" }, "2026-11")).toBe(false);
    expect(isDueIn({ ...base, lastConfirmedMonth: "2026-10" }, "2026-11")).toBe(true);
    expect(isDueIn({ ...base, startsOn: "2026-11-06" }, "2026-11")).toBe(false);
    expect(isDueIn({ ...base, endsOn: "2026-10-31" }, "2026-11")).toBe(false);
    expect(isDueIn({ ...base, active: false }, "2026-11")).toBe(false);
  });

  it("reminds from N days before until it is confirmed", () => {
    expect(reminderState(base, "2026-11-02")).toBeNull();
    expect(reminderState(base, "2026-11-03")).toEqual({ due: "2026-11-05", daysUntil: 2 });
    expect(reminderState(base, "2026-11-09")).toEqual({ due: "2026-11-05", daysUntil: -4 });
    expect(reminderState({ ...base, lastConfirmedMonth: "2026-11" }, "2026-11-09")).toBeNull();
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

describe("sync", () => {
  const row = {
    id: "3f2b8c1e-5a4d-4e0b-9c6a-1d2e3f4a5b6c",
    type: "expense",
    amountPaisa: 85000,
    occurredAt: "2026-11-09T10:00:00.000Z",
    hlc: "2026-11-09T10:00:00.000Z-0001-device1",
  };

  it("requires auth", async () => {
    const res = await app.inject({ method: "POST", url: "/v1/families/x/sync", payload: {} });
    expect(res.statusCode).toBe(401);
  });

  it("accepts the rows the mobile app sends, including tombstones", () => {
    expect(SyncTransactionSchema.safeParse(row).success).toBe(true);
    expect(SyncTransactionSchema.safeParse({ ...row, deletedAt: "2026-11-09T11:00:00.000Z" }).success).toBe(true);
    expect(SyncTransactionSchema.parse(row)).toMatchObject({ feePaisa: 0, source: "manual", isPrivate: false });
  });

  it("rejects malformed rows and clocks", () => {
    expect(SyncTransactionSchema.safeParse({ ...row, hlc: "yesterday" }).success).toBe(false);
    expect(SyncTransactionSchema.safeParse({ ...row, amountPaisa: -1 }).success).toBe(false);
    expect(SyncTransactionSchema.safeParse({ ...row, id: "not-a-uuid" }).success).toBe(false);
  });

  it("first sync has no cursor and no changes by default", () => {
    expect(SyncRequestSchema.parse({ nodeId: "d1" })).toEqual({
      nodeId: "d1",
      cursor: null,
      changes: { transactions: [] },
    });
    expect(
      SyncRequestSchema.safeParse({ nodeId: "d1", changes: { transactions: new Array(501).fill({}) } }).success,
    ).toBe(false);
  });
});
