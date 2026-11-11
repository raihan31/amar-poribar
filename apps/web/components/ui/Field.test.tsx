import { render, screen } from "@testing-library/react";
import { Field } from "./Field";

describe("Field", () => {
  it("links label, hint and error to the input", () => {
    render(<Field label="নাম" hint="পুরো নাম" error="দিতে হবে" />);
    const input = screen.getByLabelText("নাম");
    expect(input).toHaveAttribute("aria-invalid", "true");
    expect(input).toHaveAccessibleDescription("পুরো নাম দিতে হবে");
  });
});
