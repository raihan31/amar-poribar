import { render, screen } from "@testing-library/react";
import { t, type MonthSummary } from "@amar-poribar/shared";
import { describe, expect, it } from "vitest";
import { MonthSummaryCard } from "./MonthSummaryCard";

const summary: MonthSummary = {
  month: "2026-03",
  incomePaisa: 200_000,
  expensePaisa: 150_000,
  previous: { month: "2026-02", incomePaisa: 100_000, expensePaisa: 300_000 },
  byCategory: [{ categoryId: "c1", name: "বাজার", totalPaisa: 150_000 }],
  byMember: [],
  byAccount: [],
};

describe("MonthSummaryCard", () => {
  it("shows more/less with bad/good colour class", () => {
    const { container } = render(<MonthSummaryCard summary={summary} onMonth={() => {}} />);
    const deltas = [...container.querySelectorAll(".delta")];
    // income +100% (more is good), expense -50% (less is good), net saving has no percentage
    expect(deltas[0]).toHaveClass("down");
    expect(deltas[0]?.textContent).toContain(t("more"));
    expect(deltas[1]).toHaveClass("down");
    expect(deltas[1]?.textContent).toContain(t("less"));
    expect(screen.getByText("বাজার")).toBeInTheDocument();
  });

  it("marks higher expense as bad", () => {
    const worse = { ...summary, expensePaisa: 600_000 };
    const { container } = render(<MonthSummaryCard summary={worse} onMonth={() => {}} />);
    expect(container.querySelectorAll(".delta")[1]).toHaveClass("up");
  });
});
