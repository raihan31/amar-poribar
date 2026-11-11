import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { FamilyTable } from "./FamilyTable";
import type { FamilyRow } from "@/lib/api/hooks/useFamilies";

const row = (o: Partial<FamilyRow>): FamilyRow => ({
  id: "f1",
  name: "রহিম পরিবার",
  ownerPhoneMasked: "••• 678",
  members: 5,
  plan: "free",
  aiUsed: 93,
  aiLimit: 100,
  lastActiveAt: new Date().toISOString(),
  status: "active",
  ...o,
});

describe("FamilyTable", () => {
  it("status pill has icon and word", () => {
    render(<FamilyTable rows={[row({ status: "suspended" })]} />);
    expect(screen.getByText("Suspended")).toBeInTheDocument();
    expect(screen.getByTestId("pill-icon")).toHaveTextContent("■");
    expect(screen.getByText("93 / 100")).toBeInTheDocument();
    expect(screen.getByText("Today")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Open/ })).toHaveAttribute("href", "/families/f1");
  });

  it("owner none shown for no_owner", () => {
    render(<FamilyTable rows={[row({ status: "no_owner", ownerPhoneMasked: null })]} />);
    expect(screen.getByText("— none —")).toBeInTheDocument();
  });

  it("empty result offers Clear filters", () => {
    render(<FamilyTable rows={[]} onClear={() => {}} />);
    expect(screen.getByText("No families match these filters.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Clear filters" })).toBeInTheDocument();
  });
});
