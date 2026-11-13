import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { vi } from "vitest";
import { MonthSwitcher } from "./MonthSwitcher";

describe("MonthSwitcher", () => {
  it("next from December goes to January", async () => {
    const onChange = vi.fn();
    render(<MonthSwitcher month="2026-12" onChange={onChange} />);
    await userEvent.click(screen.getByRole("button", { name: "পরের মাস" }));
    expect(onChange).toHaveBeenCalledWith("2027-01");
  });

  it("previous from January goes to December", async () => {
    const onChange = vi.fn();
    render(<MonthSwitcher month="2026-01" onChange={onChange} />);
    await userEvent.click(screen.getByRole("button", { name: "আগের মাস" }));
    expect(onChange).toHaveBeenCalledWith("2025-12");
  });
});
