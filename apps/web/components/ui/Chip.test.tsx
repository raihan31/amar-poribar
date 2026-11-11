import { render, screen } from "@testing-library/react";
import { Chip } from "./Chip";

describe("Chip", () => {
  it("exposes selected state as aria-pressed", () => {
    render(<Chip selected>খাবার</Chip>);
    expect(screen.getByRole("button", { name: "খাবার" })).toHaveAttribute("aria-pressed", "true");
  });
});
