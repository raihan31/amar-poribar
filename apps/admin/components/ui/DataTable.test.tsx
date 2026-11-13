import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { DataTable, type Column } from "./DataTable";

interface Row {
  id: string;
  name: string;
}
const columns: Column<Row>[] = [
  { key: "name", header: "Name", cell: (r) => r.name, sortable: true },
  { key: "id", header: "ID", cell: (r) => r.id },
];
const rows = [
  { id: "1", name: "A" },
  { id: "2", name: "B" },
];

describe("DataTable", () => {
  it("aria-sort toggles", async () => {
    render(<DataTable caption="t" columns={columns} rows={rows} rowKey={(r) => r.id} />);
    const th = screen.getByRole("columnheader", { name: "Name" });
    expect(th).toHaveAttribute("aria-sort", "none");
    await userEvent.click(screen.getByRole("button", { name: "Name" }));
    expect(th).toHaveAttribute("aria-sort", "ascending");
    await userEvent.click(screen.getByRole("button", { name: "Name" }));
    expect(th).toHaveAttribute("aria-sort", "descending");
    expect(screen.getByRole("columnheader", { name: "ID" })).not.toHaveAttribute("aria-sort");
  });
  it("scroll container for wide tables", () => {
    render(<DataTable caption="t" columns={columns} rows={rows} rowKey={(r) => r.id} />);
    const box = screen.getByTestId("table-scroll");
    expect(box).toHaveClass("table-scroll");
    expect(box.querySelector("table")).not.toBeNull();
  });
  it("shows skeleton while loading and empty state when empty", () => {
    const { rerender } = render(<DataTable caption="t" columns={columns} rows={[]} rowKey={(r) => r.id} loading />);
    expect(screen.getAllByTestId("skeleton-row")).toHaveLength(3);
    rerender(<DataTable caption="t" columns={columns} rows={[]} rowKey={(r) => r.id} emptyTitle="None" />);
    expect(screen.getByText("None")).toBeInTheDocument();
  });
});
