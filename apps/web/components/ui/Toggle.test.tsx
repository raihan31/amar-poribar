import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Toggle } from "./Toggle";

describe("Toggle", () => {
  it("is a switch that flips on click", async () => {
    const onChange = vi.fn();
    render(<Toggle checked={false} onChange={onChange} label="শব্দ" />);
    const s = screen.getByRole("switch", { name: "শব্দ" });
    expect(s).toHaveAttribute("aria-checked", "false");
    await userEvent.click(s);
    expect(onChange).toHaveBeenCalledWith(true);
  });
});
