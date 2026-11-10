import { SyncRequestSchema, SyncTransactionSchema } from "@amar-poribar/shared";
import { describe, expect, it } from "vitest";
import { formatCursor, parseCursor } from "./domain/cursor.js";

const row = {
  id: "3f2b8c1e-5a4d-4e0b-9c6a-1d2e3f4a5b6c",
  type: "expense",
  amountPaisa: 85000,
  occurredAt: "2026-11-09T10:00:00.000Z",
  hlc: "2026-11-09T10:00:00.000Z-0001-device1",
};

describe("cursor", () => {
  it("missing or malformed means from the start", () => {
    expect(parseCursor(null)).toBe(0);
    expect(parseCursor(undefined)).toBe(0);
    expect(parseCursor("")).toBe(0);
    expect(parseCursor("abc")).toBe(0);
    expect(parseCursor("-5")).toBe(0);
    expect(parseCursor("1.5")).toBe(0);
  });

  it("round-trips", () => {
    expect(parseCursor(formatCursor(1234))).toBe(1234);
    expect(formatCursor(0)).toBe("0");
  });
});

describe("sync schemas", () => {
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
