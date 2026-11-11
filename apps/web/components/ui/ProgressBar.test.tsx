import { render, screen } from "@testing-library/react";
import { ProgressBar } from "./ProgressBar";

describe("ProgressBar", () => {
  it("clamps to 0..100 and exposes the value", () => {
    render(<ProgressBar label="খরচ" percent={140} tone="danger" />);
    expect(screen.getByRole("progressbar", { name: "খরচ" })).toHaveAttribute("aria-valuenow", "100");
  });
});
