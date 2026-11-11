import { render, screen } from "@testing-library/react";
import { EmptyState } from "./EmptyState";

describe("EmptyState", () => {
  it("shows title, hint and one next step", () => {
    render(
      <EmptyState title="কিছু নেই" hint="নতুন যোগ করুন">
        <button>যোগ</button>
      </EmptyState>,
    );
    expect(screen.getByText("কিছু নেই")).toBeInTheDocument();
    expect(screen.getByText("নতুন যোগ করুন")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "যোগ" })).toBeInTheDocument();
  });
});
