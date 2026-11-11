import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { NewFamiliesChart } from "./NewFamiliesChart";
import { overviewFixture as f } from "./types";

describe("NewFamiliesChart", () => {
  it("bar heights scale and table exists", () => {
    render(<NewFamiliesChart weeks={f.newFamiliesByWeek} />);
    const bars = screen.getAllByTestId("bar");
    expect(bars).toHaveLength(8);
    expect(bars[7]).toHaveStyle({ height: "100%" });
    expect(bars[0]).toHaveStyle({ height: "43%" });
    expect(screen.getByText("This week: 92 new")).toBeInTheDocument();
    const table = screen.getByRole("table", { hidden: true });
    expect(within(table).getAllByRole("row", { hidden: true })).toHaveLength(9);
  });
});
