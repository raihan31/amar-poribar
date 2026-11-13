import { render, screen } from "@testing-library/react";
import { BigAction } from "./BigAction";

describe("BigAction", () => {
  it("renders icon over word with min-height 84px", () => {
    const { container } = render(<BigAction icon="mic" label="বলুন" />);
    expect(screen.getByRole("button", { name: "বলুন" })).toHaveStyle({ minHeight: "84px" });
    expect(container.querySelector("svg")).not.toBeNull();
  });
});
