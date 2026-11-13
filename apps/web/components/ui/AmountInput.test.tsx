import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { AmountInput } from "./AmountInput";

describe("AmountInput", () => {
  it("shows ৳ ৮৫০ and আটশো পঞ্চাশ টাকা", () => {
    render(<AmountInput label="পরিমাণ" valuePaisa={85000} onChange={() => {}} />);
    expect(screen.getByText("৳ ৮৫০")).toBeInTheDocument();
    expect(screen.getByText("আটশো পঞ্চাশ টাকা")).toBeInTheDocument();
  });

  it("typing digits reports integer paisa", async () => {
    const onChange = vi.fn();
    render(<AmountInput label="পরিমাণ" valuePaisa={0} onChange={onChange} />);
    await userEvent.type(screen.getByLabelText("পরিমাণ"), "5");
    expect(onChange).toHaveBeenCalledWith(500);
  });
});
