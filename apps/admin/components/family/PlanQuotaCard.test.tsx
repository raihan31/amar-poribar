import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { PlanQuotaCard } from "./PlanQuotaCard";
import { fmtTaka } from "./types";

const card = (used: number) => (
  <PlanQuotaCard
    plan="free"
    ai={{ used, limit: 100, resetsOn: "2026-12-01", costPaisa: 980 }}
    canChange
    onChangePlan={() => {}}
    onAddQuota={() => {}}
  />
);

describe("PlanQuotaCard", () => {
  it("bar turns amber at 90%", () => {
    const { rerender } = render(card(89));
    expect(screen.getByRole("progressbar")).toHaveAttribute("data-tone", "normal");
    rerender(card(90));
    expect(screen.getByRole("progressbar")).toHaveAttribute("data-tone", "amber");
    expect(screen.getByText("90 / 100")).toBeInTheDocument();
  });

  it("shows reset date and cost in taka from paisa", () => {
    render(card(93));
    expect(screen.getByText("Resets on 1 Dec · cost this month: ৳ 9.8")).toBeInTheDocument();
    expect(fmtTaka(1200)).toBe("৳ 12");
    expect(fmtTaka(5)).toBe("৳ 0.05");
  });
});
