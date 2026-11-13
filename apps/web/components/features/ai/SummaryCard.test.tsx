import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { SummaryCard } from "./SummaryCard";

const text =
  "নভেম্বর মাসে পরিবারের মোট খরচ ৳ ৪২,৫০০। গত মাসের চেয়ে ৳ ৩,২০০ বেশি। সবচেয়ে বেশি খরচ বাজার খাতে, ৳ ১৬,৮০০। একটা কথা: চাল-ডাল একসাথে কিনলে খরচ কমতে পারে।";

describe("SummaryCard", () => {
  it("amounts bold and change coloured", () => {
    render(<SummaryCard text={text} />);
    const total = screen.getByText("৳ ৪২,৫০০");
    const change = screen.getByText("৳ ৩,২০০");
    const top = screen.getByText("৳ ১৬,৮০০");
    for (const el of [total, change, top]) expect(el.tagName).toBe("B");
    expect(change).toHaveClass("sum-amount--up");
    expect(total).not.toHaveClass("sum-amount--up");
    expect(top).not.toHaveClass("sum-amount--up");
  });

  it("does not colour the change when spending fell", () => {
    render(<SummaryCard text="গত মাসের চেয়ে ৳ ১০০ কম।" />);
    expect(screen.getByText("৳ ১০০")).not.toHaveClass("sum-amount--up");
  });

  it("shows the tip in its own block", () => {
    render(<SummaryCard text={text} />);
    expect(screen.getByText(/চাল-ডাল একসাথে/).closest(".sum-tip")).not.toBeNull();
  });
});
