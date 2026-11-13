import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { PlanCard } from "./PlanCard";
import { plansFixture } from "./types";

const plus = plansFixture.plans[1]!;

describe("PlanCard", () => {
  it("price fields only for staff owner", () => {
    const { rerender } = render(<PlanCard plan={plus} canEditQuota canEditPricing onSave={() => {}} />);
    expect(screen.getByLabelText("Monthly price (৳)")).toBeInTheDocument();
    expect(screen.getByLabelText("Member limit")).toBeInTheDocument();
    rerender(<PlanCard plan={plus} canEditQuota canEditPricing={false} onSave={() => {}} />);
    expect(screen.queryByLabelText("Monthly price (৳)")).toBeNull();
    expect(screen.queryByLabelText("Member limit")).toBeNull();
    expect(screen.getByLabelText("AI entries per month")).toBeInTheDocument();
    expect(screen.getByText("৳ 99 / month · ৳ 999 / year")).toBeInTheDocument();
    expect(screen.getByText("231 families")).toBeInTheDocument();
  });

  it("read-only staff cannot edit the quota", () => {
    render(<PlanCard plan={plus} canEditQuota={false} canEditPricing={false} onSave={() => {}} />);
    expect(screen.queryByLabelText("AI entries per month")).toBeNull();
  });
});
