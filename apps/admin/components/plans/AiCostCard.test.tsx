import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { AiCostCard } from "./AiCostCard";

describe("AiCostCard", () => {
  it("goal met shows check", () => {
    render(<AiCostCard cost={{ perFamilyPaisa: 1140, goalPaisa: 1500 }} />);
    expect(screen.getByText("৳ 11.4")).toBeInTheDocument();
    expect(screen.getByText(/76% of the ৳ 15 goal \(NFR-13\)/)).toBeInTheDocument();
    expect(screen.getByText(/✓ Within goal/)).toBeInTheDocument();
    expect(screen.getByText(/Template fallback is used when quota runs out/)).toBeInTheDocument();
  });

  it("over 90% shows warning", () => {
    render(<AiCostCard cost={{ perFamilyPaisa: 1400, goalPaisa: 1500 }} />);
    expect(screen.getByText(/93% of the ৳ 15 goal/)).toBeInTheDocument();
    expect(screen.getByText(/⚠ Close to goal/)).toBeInTheDocument();
    expect(screen.queryByText(/✓ Within goal/)).toBeNull();
  });
});
