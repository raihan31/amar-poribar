import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { StepList } from "./StepList";

describe("StepList", () => {
  it("states have text", () => {
    render(
      <StepList
        steps={[
          { key: "a", label: "Confirm OTP", state: "done" },
          { key: "b", label: "Transfer", state: "waiting" },
          { key: "c", label: "Offer export", state: "todo" },
          { key: "d", label: "Erase", state: "todo", auto: true, nextRunAt: "2026-11-12T02:00:00Z" },
        ]}
      />,
    );
    expect(screen.getByText("Done")).toBeInTheDocument();
    expect(screen.getByText("Waiting")).toBeInTheDocument();
    expect(screen.getAllByText("To do")).toHaveLength(2);
    expect(screen.getByText(/Runs automatically — next run/)).toBeInTheDocument();
    expect(screen.queryByRole("button")).toBeNull();
  });
});
