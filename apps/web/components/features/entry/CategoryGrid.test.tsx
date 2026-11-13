import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Category } from "@/lib/types";
import { CategoryGrid } from "./CategoryGrid";

const cats: Category[] = [
  { id: "c1", key: "grocery", kind: "expense", nameBn: "বাজার", nameEn: "Groceries", icon: null },
  { id: "c2", key: "rent", kind: "expense", nameBn: "বাসা ভাড়া", nameEn: "Rent", icon: null },
  { id: "c3", key: "bill", kind: "expense", nameBn: "বিল", nameEn: "Bills", icon: null },
];

beforeEach(() => {
  vi.stubGlobal(
    "SpeechSynthesisUtterance",
    class {
      constructor(public text: string) {}
    },
  );
});

describe("CategoryGrid", () => {
  it("tap speaks name and selects", async () => {
    const onSelect = vi.fn();
    const { rerender } = render(<CategoryGrid categories={cats} selectedKey={null} onSelect={onSelect} />);
    await userEvent.click(screen.getByRole("button", { name: "বাসা ভাড়া" }));
    expect(globalThis.__spoken).toEqual(["বাসা ভাড়া"]);
    expect(onSelect).toHaveBeenCalledWith("rent");

    rerender(<CategoryGrid categories={cats} selectedKey="rent" onSelect={onSelect} />);
    const sel = screen.getByRole("button", { name: "বাসা ভাড়া" });
    expect(sel).toHaveAttribute("aria-pressed", "true");
    expect(sel).toHaveTextContent("✓");
    expect(screen.getByRole("button", { name: "বিল" })).toHaveAttribute("aria-pressed", "false");
  });

  it("tiles are at least 104px tall", () => {
    render(<CategoryGrid categories={cats} selectedKey={null} onSelect={() => {}} />);
    for (const b of screen.getAllByRole("button")) expect(parseInt(b.style.minHeight, 10)).toBeGreaterThanOrEqual(104);
  });
});
