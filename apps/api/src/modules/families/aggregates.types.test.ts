import { describe, expect, expectTypeOf, it } from "vitest";
import { PRIVATE_FIELDS } from "@amar-poribar/shared";
import type { FamiliesFacade } from "./index.js";

type Keys<T> = T extends readonly (infer U)[]
  ? Keys<U>
  : T extends Date
    ? never
    : T extends object
      ? { [K in keyof T]: K | Keys<T[K]> }[keyof T]
      : never;
type Resolved<F> = F extends (...a: never[]) => Promise<infer R> ? R : never;
type Private = (typeof PRIVATE_FIELDS)[number];

describe("staff-safe aggregates", () => {
  it("aggregates contain no private fields", () => {
    expectTypeOf<Extract<Keys<Resolved<FamiliesFacade["listFamilySummaries"]>>, Private>>().toEqualTypeOf<never>();
    expectTypeOf<Extract<Keys<Resolved<FamiliesFacade["getFamilyAggregate"]>>, Private>>().toEqualTypeOf<never>();
    expectTypeOf<Extract<Keys<Resolved<FamiliesFacade["listFamiliesWithoutOwner"]>>, Private>>().toEqualTypeOf<never>();
    // Sanity: the helper does detect a private key.
    expectTypeOf<Keys<{ a: { phone: string } }>>().toEqualTypeOf<"a" | "phone">();
    expect(PRIVATE_FIELDS).toContain("phone");
  });
});
