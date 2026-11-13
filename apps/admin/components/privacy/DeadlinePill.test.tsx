import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { DeadlinePill } from "./DeadlinePill";

const now = new Date("2026-11-11T00:00:00Z");
const due = (days: number) => new Date(now.getTime() + days * 86_400_000).toISOString();

describe("DeadlinePill", () => {
  it("7 days is amber warning and 4 days red", () => {
    const { container, rerender } = render(<DeadlinePill dueAt={due(7)} now={now} />);
    expect(screen.getByText("7 days left")).toBeInTheDocument();
    expect(container.querySelector(".ui-pill--warn")).not.toBeNull();
    expect(screen.getByText("⚠")).toBeInTheDocument();
    rerender(<DeadlinePill dueAt={due(4)} now={now} />);
    expect(screen.getByText("4 days left")).toBeInTheDocument();
    expect(container.querySelector(".ui-pill--risk")).not.toBeNull();
    expect(screen.getByText("■")).toBeInTheDocument();
  });

  it("more than 10 days is neutral", () => {
    const { container } = render(<DeadlinePill dueAt={due(22)} now={now} />);
    expect(screen.getByText("22 days left")).toBeInTheDocument();
    expect(container.querySelector(".ui-pill--neutral")).not.toBeNull();
  });

  it("overdue text", () => {
    const { container } = render(<DeadlinePill dueAt={due(-3)} now={now} />);
    expect(screen.getByText("Overdue by 3 days")).toBeInTheDocument();
    expect(container.querySelector(".ui-pill--risk")).not.toBeNull();
  });
});
