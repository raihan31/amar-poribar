import { render, screen } from "@testing-library/react";
import { IconButton } from "./IconButton";
import { iconNames } from "./icons";

describe("IconButton", () => {
  it("uses the label as its accessible name", () => {
    render(<IconButton icon="back" label="পেছনে" />);
    expect(screen.getByRole("button", { name: "পেছনে" })).toBeInTheDocument();
  });
  it("icon set has the required names", () => {
    for (const n of [
      "mic",
      "buzz",
      "chat",
      "video",
      "home",
      "list",
      "budget",
      "family",
      "gear",
      "play",
      "speaker",
      "check",
      "close",
      "back",
      "camera",
      "receipt",
      "lock",
      "warning",
      "info",
    ]) {
      expect(iconNames).toContain(n);
    }
  });
});
