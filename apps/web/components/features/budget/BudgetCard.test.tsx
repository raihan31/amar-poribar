import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { translate } from "@/lib/i18n/useT";
import type { BudgetRow } from "@/lib/types";
import { BudgetCard } from "./BudgetCard";

const row = (level: BudgetRow["level"], spent: number): BudgetRow => ({
  categoryId: "c1",
  nameBn: "বাজার ও মুদি",
  nameEn: "Groceries",
  limitPaisa: 1_000_000,
  spentPaisa: spent,
  level,
  inherited: false,
});
const tell = { id: "u2", name: "আম্মু" };

describe("BudgetCard", () => {
  it("exceeded shows word, icon and over amount", () => {
    const { container } = render(<BudgetCard row={row("exceeded", 1_050_000)} tell={tell} canTell />);
    expect(screen.getByText(translate("bn", "bud.over", { amount: "৳ ৫০০" }))).toBeInTheDocument();
    expect(container.querySelector('[data-icon="alert"]')).not.toBeNull();
    expect(screen.getByText("৳ ১০,৫০০ / ৳ ১০,০০০")).toBeInTheDocument();
  });

  it("warning and ok show their words with icons", () => {
    const { container, rerender } = render(<BudgetCard row={row("warning", 850_000)} tell={tell} canTell />);
    expect(screen.getByText(translate("bn", "bud.warn", { pct: "৮০" }))).toBeInTheDocument();
    expect(container.querySelector('[data-icon="warning"]')).not.toBeNull();
    rerender(<BudgetCard row={row("ok", 400_000)} tell={tell} canTell />);
    expect(screen.getByText(translate("bn", "bud.ok"))).toBeInTheDocument();
    expect(container.querySelector('[data-icon="check"]')).not.toBeNull();
  });

  it("buzz button only on exceeded", () => {
    const { rerender } = render(<BudgetCard row={row("exceeded", 1_050_000)} tell={tell} canTell />);
    const link = screen.getByRole("link", { name: "আম্মুকে কম্পন দিন" });
    expect(link).toHaveAttribute("href", "/buzz?to=u2&phrase=budget");
    rerender(<BudgetCard row={row("warning", 850_000)} tell={tell} canTell />);
    expect(screen.queryByRole("link")).toBeNull();
    rerender(<BudgetCard row={row("ok", 100)} tell={tell} canTell />);
    expect(screen.queryByRole("link")).toBeNull();
  });
});
