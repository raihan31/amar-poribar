import { render, screen, act } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { FamilyFilters } from "./FamilyFilters";

const nav = vi.hoisted(() => ({ search: "", replace: undefined as unknown as (url: string) => void }));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: (u: string) => nav.replace(u) }),
  usePathname: () => "/families",
  useSearchParams: () => new URLSearchParams(nav.search),
}));

describe("FamilyFilters", () => {
  beforeEach(() => {
    nav.search = "";
    nav.replace = vi.fn((u: string) => {
      nav.search = u.split("?")[1] ?? "";
    });
  });
  afterEach(() => vi.useRealTimers());

  it("filters round-trip through the URL", async () => {
    const user = userEvent.setup();
    const { rerender } = render(<FamilyFilters />);
    await user.selectOptions(screen.getByLabelText("Plan"), "plus");
    expect(nav.replace).toHaveBeenLastCalledWith("/families?plan=plus");
    rerender(<FamilyFilters />);
    await user.selectOptions(screen.getByLabelText("Status"), "dormant");
    rerender(<FamilyFilters />);
    await user.selectOptions(screen.getByLabelText("AI quota"), "over90");
    rerender(<FamilyFilters />);
    expect(nav.search).toBe("plan=plus&status=dormant&quota=over90");
    // URL drives the controls
    expect(screen.getByLabelText("Plan")).toHaveValue("plus");
    expect(screen.getByLabelText("AI quota")).toHaveValue("over90");
  });

  it("debounces search by 300 ms", async () => {
    vi.useFakeTimers();
    render(<FamilyFilters />);
    const box = screen.getByPlaceholderText(/Search by family name or owner phone/);
    const { fireEvent } = await import("@testing-library/react");
    fireEvent.change(box, { target: { value: "678" } });
    act(() => vi.advanceTimersByTime(299));
    expect(nav.replace).not.toHaveBeenCalled();
    act(() => vi.advanceTimersByTime(2));
    expect(nav.replace).toHaveBeenCalledWith("/families?q=678");
  });
});
