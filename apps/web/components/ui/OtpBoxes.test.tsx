import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { OtpBoxes } from "./OtpBoxes";

function boxes() {
  return screen.getAllByRole("textbox") as HTMLInputElement[];
}

describe("OtpBoxes", () => {
  it("has six numeric one-time-code inputs", () => {
    render(<OtpBoxes boxLabel={(i) => `অঙ্ক ${i}`} />);
    expect(boxes()).toHaveLength(6);
    expect(boxes()[0]).toHaveAttribute("inputmode", "numeric");
    expect(boxes()[0]).toHaveAttribute("autocomplete", "one-time-code");
  });

  it("pasting 6 digits fills all boxes", () => {
    const onChange = vi.fn();
    render(<OtpBoxes onChange={onChange} boxLabel={(i) => `অঙ্ক ${i}`} />);
    fireEvent.paste(boxes()[2]!, { clipboardData: { getData: () => "123456" } });
    expect(boxes().map((b) => b.value)).toEqual(["1", "2", "3", "4", "5", "6"]);
    expect(onChange).toHaveBeenLastCalledWith("123456");
  });

  it("backspace moves focus back", async () => {
    const user = userEvent.setup();
    render(<OtpBoxes boxLabel={(i) => `অঙ্ক ${i}`} />);
    await user.click(boxes()[0]!);
    await user.keyboard("12");
    expect(boxes()[2]).toHaveFocus();
    await user.keyboard("{Backspace}");
    expect(boxes()[1]).toHaveFocus();
  });
});
