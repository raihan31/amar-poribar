import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type { BudgetRow } from "@/lib/types";
import { BudgetStrip } from "./BudgetStrip";

const row = (level: BudgetRow["level"]): BudgetRow => ({
  categoryId: "c1",
  nameBn: "বাজার",
  nameEn: "Groceries",
  limitPaisa: 1_000_000,
  spentPaisa: 800_000,
  level,
  inherited: false,
});

describe("BudgetStrip", () => {
  it("hidden without alerts", () => {
    const { container } = render(<BudgetStrip rows={[row("ok")]} tell={{ id: "u2", name: "আম্মু" }} canTell />);
    expect(container).toBeEmptyDOMElement();
  });

  it("tell someone links to buzz with recipient", () => {
    render(<BudgetStrip rows={[row("ok"), row("warning")]} tell={{ id: "u2", name: "আম্মু" }} canTell />);
    expect(screen.getByText("বাজারের বাজেট ৮০% শেষ")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "আম্মুকে জানান" })).toHaveAttribute("href", "/buzz?to=u2&phrase=budget");
  });
});
