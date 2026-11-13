import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { staffFixture } from "@/mocks/fixtures";
import { StaffTable } from "./StaffTable";

const now = new Date("2026-11-11T10:00:00+06:00");
const noop = () => {};

describe("StaffTable", () => {
  it("own row has no disable", () => {
    render(<StaffTable items={staffFixture(now)} selfId="s1" now={now} onAction={noop} />);
    const own = screen.getByText("rubel@amarporibar.example").closest("tr")!;
    expect(within(own).queryByRole("button")).toBeNull();
    const other = screen.getByText("support@amarporibar.example").closest("tr")!;
    expect(within(other).getByRole("button", { name: "Disable" })).toBeInTheDocument();
  });

  it("locked until 2FA shows warning and reminder button", () => {
    render(<StaffTable items={staffFixture(now)} selfId="s1" now={now} onAction={noop} />);
    const row = screen.getByText("auditor@amarporibar.example").closest("tr")!;
    expect(within(row).getByText("Locked until 2FA")).toBeInTheDocument();
    expect(within(row).getByText("Not set")).toBeInTheDocument();
    expect(within(row).getByText("Never")).toBeInTheDocument();
    expect(within(row).getByRole("button", { name: "Send reminder" })).toBeInTheDocument();
  });

  it("non-owners see no action buttons", () => {
    render(<StaffTable items={staffFixture(now)} canAct={false} now={now} onAction={noop} />);
    expect(screen.queryByRole("button")).toBeNull();
  });
});
