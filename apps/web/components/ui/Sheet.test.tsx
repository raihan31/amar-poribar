import { render, screen } from "@testing-library/react";
import { Sheet } from "./Sheet";

describe("Sheet", () => {
  it("is a dialog with the sheet class", () => {
    render(
      <Sheet open onClose={() => {}} title="বাছুন" closeLabel="বন্ধ">
        ভেতরে
      </Sheet>,
    );
    expect(screen.getByRole("dialog", { hidden: true })).toHaveClass("ui-sheet");
  });
});
