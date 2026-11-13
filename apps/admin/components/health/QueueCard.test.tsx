import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { QueueCard } from "./QueueCard";

describe("QueueCard", () => {
  it("dead letters zero vs attention", () => {
    const { rerender } = render(<QueueCard depth={3} deadLetters={0} />);
    expect(screen.getByText("Dead letters: 0 ✓")).toBeInTheDocument();
    rerender(<QueueCard depth={3} deadLetters={4} />);
    expect(screen.getByText("⚠ 4 need attention")).toBeInTheDocument();
  });
});
