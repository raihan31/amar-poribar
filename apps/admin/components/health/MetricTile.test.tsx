import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { MetricTile } from "./MetricTile";
import { healthFixture } from "./types";

const base = healthFixture.tiles[0]!;

describe("MetricTile", () => {
  it("status icon and word for ok warn risk", () => {
    const { rerender } = render(<MetricTile tile={{ ...base, status: "ok" }} />);
    expect(screen.getByText("✓")).toBeInTheDocument();
    expect(screen.getByText("OK:")).toBeInTheDocument();
    expect(screen.getByText("99.71%")).toBeInTheDocument();
    rerender(<MetricTile tile={{ ...base, status: "warn", note: "Below usual 98.5%" }} />);
    expect(screen.getByText("⚠")).toBeInTheDocument();
    expect(screen.getByText("Warning:")).toBeInTheDocument();
    expect(screen.getByText(/Below usual 98.5%/)).toBeInTheDocument();
    rerender(<MetricTile tile={{ ...base, status: "risk" }} />);
    expect(screen.getByText("■")).toBeInTheDocument();
    expect(screen.getByText("At risk:")).toBeInTheDocument();
  });
  it("renders unit after value", () => {
    render(<MetricTile tile={healthFixture.tiles[1]!} />);
    expect(screen.getByText("212 ms")).toBeInTheDocument();
  });
});
