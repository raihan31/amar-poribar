import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { Button } from "./Button";
import { Card } from "./Card";
import { Countdown, formatRemaining } from "./Countdown";
import { CopyButton } from "./CopyButton";
import { EmptyState } from "./EmptyState";
import { FilterBar } from "./FilterBar";
import { Kpi } from "./Kpi";
import { Pagination } from "./Pagination";
import { SelectField } from "./SelectField";
import { TextField } from "./TextField";
import { Toast } from "./Toast";

describe("ui kit", () => {
  it("Button defaults to type=button", () => {
    render(<Button>Go</Button>);
    expect(screen.getByRole("button", { name: "Go" })).toHaveAttribute("type", "button");
  });
  it("Card, Kpi, EmptyState render content", () => {
    render(
      <>
        <Card title="T">body</Card>
        <Kpi label="Families" value="12" />
        <EmptyState title="Empty" hint="none yet" />
      </>,
    );
    for (const t of ["T", "body", "Families", "12", "Empty", "none yet"])
      expect(screen.getByText(t)).toBeInTheDocument();
  });
  it("fields are labelled", () => {
    render(
      <FilterBar>
        <TextField label="Search" error="bad" />
        <SelectField label="Plan" options={[{ value: "a", label: "A" }]} />
      </FilterBar>,
    );
    expect(screen.getByLabelText("Search")).toHaveAttribute("aria-invalid", "true");
    expect(screen.getByLabelText("Plan")).toBeInTheDocument();
    expect(screen.getByRole("search")).toBeInTheDocument();
  });
  it("Pagination disables at the ends", async () => {
    const onPage = vi.fn();
    render(<Pagination page={1} pageSize={10} total={25} onPage={onPage} />);
    expect(screen.getByRole("button", { name: "Previous" })).toBeDisabled();
    await userEvent.click(screen.getByRole("button", { name: "Next" }));
    expect(onPage).toHaveBeenCalledWith(2);
    expect(screen.getByText("Page 1 of 3")).toBeInTheDocument();
  });
  it("Countdown formats remaining time", () => {
    expect(formatRemaining(0)).toBe("Due now");
    expect(formatRemaining(90 * 60_000)).toBe("1h 30m left");
    expect(formatRemaining(26 * 3_600_000)).toBe("1d 2h left");
    render(<Countdown until={new Date(1_000_000 + 5 * 60_000)} now={() => 1_000_000} />);
    expect(screen.getByText("5m left")).toBeInTheDocument();
  });
  it("Toast shows and auto-dismisses", () => {
    vi.useFakeTimers();
    const done = vi.fn();
    render(<Toast message="Saved" onDone={done} ms={100} />);
    expect(screen.getByRole("status")).toHaveTextContent("Saved");
    vi.advanceTimersByTime(150);
    expect(done).toHaveBeenCalled();
    vi.useRealTimers();
  });
  it("CopyButton writes to the clipboard", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", { value: { writeText }, configurable: true });
    render(<CopyButton value="abc" />);
    await userEvent.click(screen.getByRole("button", { name: "Copy" }));
    expect(writeText).toHaveBeenCalledWith("abc");
    expect(await screen.findByRole("button", { name: "Copied" })).toBeInTheDocument();
  });
});
