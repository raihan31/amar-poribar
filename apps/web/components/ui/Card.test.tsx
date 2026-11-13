import { render, screen } from "@testing-library/react";
import { Card } from "./Card";

describe("Card", () => {
  it("renders children in a card", () => {
    render(<Card data-testid="c">ভেতরে</Card>);
    expect(screen.getByTestId("c")).toHaveClass("ui-card");
    expect(screen.getByText("ভেতরে")).toBeInTheDocument();
  });
});
