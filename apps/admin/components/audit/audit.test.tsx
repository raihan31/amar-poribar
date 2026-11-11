import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { VERIFY_IN_OPENAPI, type AuditItem } from "@/lib/audit/types";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const replace = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace, push: vi.fn(), back: vi.fn() }),
  usePathname: () => "/audit",
  useSearchParams: () => new URLSearchParams("range=7d"),
}));

import { AuditTable } from "./AuditTable";
import { AuditFilters } from "./AuditFilters";
import { ChainStatus } from "./ChainStatus";

const kinds = ["risky", "privacy", "read", "change", "signin", "security"] as const;
const items: AuditItem[] = kinds.map((kind, i) => ({
  id: i + 1,
  at: "2026-11-11T03:12:00Z",
  staffName: "Rubel",
  action: "Did it",
  kind,
  familyName: i === 0 ? "মিয়া পরিবার" : null,
  reason: null,
}));

describe("AuditTable", () => {
  it("kind pills have words", () => {
    render(<AuditTable items={items} />);
    for (const w of ["Risky", "Privacy", "Read", "Change", "Sign-in", "Security"]) {
      expect(screen.getByText(w)).toBeInTheDocument();
    }
    expect(screen.getAllByText("11 Nov, 09:12")).toHaveLength(6);
    expect(screen.getAllByText("—").length).toBeGreaterThan(0);
  });
  it("no edit or delete controls", () => {
    render(<AuditTable items={items} />);
    expect(screen.queryByRole("button", { name: /edit|delete|remove/i })).toBeNull();
    expect(screen.queryAllByRole("button")).toHaveLength(0);
  });
});

describe("AuditFilters", () => {
  it("filters in URL", async () => {
    render(<AuditFilters staffNames={["Rubel"]} />);
    await userEvent.selectOptions(screen.getByLabelText("Staff"), "Rubel");
    expect(replace).toHaveBeenLastCalledWith("/audit?staff=Rubel&range=7d");
    await userEvent.selectOptions(screen.getByLabelText("Action"), "Changed plan");
    expect(replace.mock.lastCall?.[0]).toContain("action=plan.changed");
  });
});

describe("ChainStatus", () => {
  it("broken chain is red with id", () => {
    render(<ChainStatus chain={{ ok: false, brokenAt: 77 }} />);
    expect(screen.getByRole("alert")).toHaveTextContent("Chain broken at #77");
    expect(screen.queryByRole("button", { name: "Verify now" })).toBeNull();
  });
  it("verified chain and verify button refreshes", async () => {
    const onVerify = vi.fn().mockResolvedValue({ ok: false, brokenAt: 5 });
    render(<ChainStatus chain={{ ok: true, verifiedThrough: 214 }} onVerify={onVerify} />);
    expect(screen.getByText("Chain verified through #214")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Verify now" }));
    expect(await screen.findByText("Chain broken at #5")).toBeInTheDocument();
  });
});

describe("verify flag", () => {
  it("matches the OpenAPI document", () => {
    const spec = readFileSync(resolve(process.cwd(), "../api/openapi.json"), "utf8");
    expect(spec.includes("/admin/v1/audit/verify")).toBe(VERIFY_IN_OPENAPI);
  });
});
