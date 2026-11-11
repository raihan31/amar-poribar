import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { KpiRow, formatTakaPaisa } from "./KpiRow";
import { overviewFixture as f } from "./types";

describe("KpiRow", () => {
  it("goal met shows check and word", () => {
    render(<KpiRow {...f} />);
    expect(screen.getByText("✓ Goal: 2.5 or more (met)")).toBeInTheDocument();
    expect(screen.getByText("✓ Goal: ৳ 15 or less (met)")).toBeInTheDocument();
    expect(screen.getByText("৳ 11.4")).toBeInTheDocument();
    expect(screen.getByText("1,284")).toBeInTheDocument();
    expect(screen.getByText("+86 vs previous 30 days")).toBeInTheDocument();
  });
  it("goal not met shows warning and word", () => {
    render(<KpiRow {...f} avgMembers={2.1} aiCostPerFamilyPaisa={1600} />);
    expect(screen.getByText("⚠ Goal: 2.5 or more (not met)")).toBeInTheDocument();
    expect(screen.getByText("⚠ Goal: ৳ 15 or less (not met)")).toBeInTheDocument();
  });
  it("oldest request ≥ 10 days is amber", () => {
    const { rerender } = render(<KpiRow {...f} oldestPrivacyRequestDays={12} />);
    expect(screen.getByTestId("oldest-request")).toHaveStyle({ color: "#9a2a00" });
    expect(screen.getByTestId("oldest-request")).toHaveTextContent("Oldest: 12 days of 30");
    rerender(<KpiRow {...f} oldestPrivacyRequestDays={9} />);
    expect(screen.getByTestId("oldest-request")).not.toHaveStyle({ color: "#9a2a00" });
  });
  it("formats paisa without floats", () => {
    expect(formatTakaPaisa(1500)).toBe("৳ 15");
    expect(formatTakaPaisa(1105)).toBe("৳ 11.05");
  });
});
