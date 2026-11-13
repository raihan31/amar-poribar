import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Button } from "./Button";

describe("Button", () => {
  it("xl size has min-height 72px in simple mode", () => {
    document.documentElement.setAttribute("data-simple", "1");
    render(<Button size="xl">ঠিক আছে</Button>);
    expect(screen.getByRole("button", { name: "ঠিক আছে" })).toHaveStyle({ minHeight: "72px" });
    document.documentElement.removeAttribute("data-simple");
  });

  it("sizes map to 48, 56 and 72px", () => {
    render(
      <>
        <Button>a</Button>
        <Button size="lg">b</Button>
      </>,
    );
    expect(screen.getByText("a")).toHaveStyle({ minHeight: "48px" });
    expect(screen.getByText("b")).toHaveStyle({ minHeight: "56px" });
  });

  it("disabled has aria-disabled", async () => {
    const onClick = vi.fn();
    render(
      <Button disabled onClick={onClick}>
        পাঠান
      </Button>,
    );
    const b = screen.getByRole("button", { name: "পাঠান" });
    expect(b).toHaveAttribute("aria-disabled", "true");
    await userEvent.click(b);
    expect(onClick).not.toHaveBeenCalled();
  });

  it("variant sets a class", () => {
    render(<Button variant="buzz">বাজ</Button>);
    expect(screen.getByRole("button")).toHaveClass("ui-btn--buzz");
  });
});
