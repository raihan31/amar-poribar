import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

describe("smoke", () => {
  it("renders with jsdom and jest-dom matchers", () => {
    render(<div data-testid="x">hello</div>);
    expect(screen.getByTestId("x")).toBeInTheDocument();
    expect(screen.getByTestId("x")).toHaveTextContent("hello");
  });
});
