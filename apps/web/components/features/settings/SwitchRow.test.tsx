import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { SwitchRow } from "./SwitchRow";

describe("SwitchRow", () => {
  it("is a real checkbox with label", async () => {
    const onChange = vi.fn();
    render(<SwitchRow label="সহজ মোড" sub="বড় লেখা" checked={false} onChange={onChange} />);
    const box = screen.getByRole("checkbox", { name: "সহজ মোড" });
    expect(box.tagName).toBe("INPUT");
    expect(box).not.toBeChecked();
    await userEvent.click(box);
    expect(onChange).toHaveBeenCalledWith(true);
  });
});
