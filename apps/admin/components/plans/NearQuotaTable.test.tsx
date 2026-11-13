import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { NearQuotaTable } from "./NearQuotaTable";
import { plansFixture } from "./types";

describe("NearQuotaTable", () => {
  it("states have icons and words", () => {
    render(<NearQuotaTable rows={plansFixture.nearQuota} />);
    const row = (name: string) => screen.getByText(name).closest("tr")!;
    expect(within(row("মিয়া পরিবার")).getByText("Quota reached")).toBeInTheDocument();
    expect(within(row("মিয়া পরিবার")).getByText("■")).toBeInTheDocument();
    expect(within(row("রহিম পরিবার")).getByText("93% used")).toBeInTheDocument();
    expect(within(row("রহিম পরিবার")).getByText("⚠")).toBeInTheDocument();
    expect(within(row("হোসেন পরিবার")).getByText("On track")).toBeInTheDocument();
    expect(within(row("হোসেন পরিবার")).getByText("✓")).toBeInTheDocument();
    expect(within(row("হোসেন পরিবার")).getByText("760 / 1,000")).toBeInTheDocument();
    expect(within(row("হোসেন পরিবার")).getByText("1 Dec")).toBeInTheDocument();
    expect(screen.getByText("Counts only. Staff cannot see what was entered.")).toBeInTheDocument();
    expect(within(row("হোসেন পরিবার")).getByRole("link", { name: /Open/ })).toHaveAttribute("href", "/families/f3");
  });
});
