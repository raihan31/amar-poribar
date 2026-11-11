import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { vi } from "vitest";
import { BackHeader } from "./BackHeader";
import { PageHeader } from "./PageHeader";

const back = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ back }) }));

describe("headers", () => {
  it("BackHeader has a labelled back button", async () => {
    render(<BackHeader title="বাজেট" />);
    await userEvent.click(screen.getByRole("button", { name: "পেছনে" }));
    expect(back).toHaveBeenCalled();
  });

  it("PageHeader shows gear link to /settings only when asked", () => {
    const { rerender } = render(<PageHeader title="হোম" />);
    expect(screen.queryByRole("link")).toBeNull();
    rerender(<PageHeader title="হোম" gear />);
    expect(screen.getByRole("link", { name: "সেটিংস" })).toHaveAttribute("href", "/settings");
  });
});
