import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { SegmentedControl } from "./SegmentedControl";

describe("SegmentedControl", () => {
  it("marks the selected option and reports changes", async () => {
    const onChange = vi.fn();
    render(
      <SegmentedControl
        label="মাস"
        value="a"
        onChange={onChange}
        options={[
          { value: "a", label: "এ" },
          { value: "b", label: "বি" },
        ]}
      />,
    );
    expect(screen.getByRole("radio", { name: "এ" })).toHaveAttribute("aria-checked", "true");
    await userEvent.click(screen.getByRole("radio", { name: "বি" }));
    expect(onChange).toHaveBeenCalledWith("b");
  });
});
