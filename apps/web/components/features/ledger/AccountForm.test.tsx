import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { AccountForm } from "./AccountForm";

describe("AccountForm", () => {
  it("type chips are single-select", async () => {
    render(<AccountForm onSubmit={() => {}} />);
    const cash = screen.getByRole("button", { name: /ক্যাশ/ });
    const bkash = screen.getByRole("button", { name: /বিকাশ/ });
    expect(cash).toHaveAttribute("aria-pressed", "true");
    await userEvent.click(bkash);
    expect(bkash).toHaveAttribute("aria-pressed", "true");
    expect(cash).toHaveAttribute("aria-pressed", "false");
    expect(screen.getAllByRole("button", { pressed: true })).toHaveLength(1);
  });

  it("opening balance converts to paisa", async () => {
    const onSubmit = vi.fn();
    render(<AccountForm onSubmit={onSubmit} />);
    await userEvent.click(screen.getByRole("button", { name: /নগদ/ }));
    await userEvent.type(screen.getByLabelText("অ্যাকাউন্টের নাম"), "আম্মুর নগদ");
    await userEvent.type(screen.getByLabelText("শুরুতে কত টাকা ছিল?"), "৫০০");
    await userEvent.click(screen.getByRole("button", { name: "অ্যাকাউন্ট যোগ করুন" }));
    expect(onSubmit).toHaveBeenCalledWith({ name: "আম্মুর নগদ", type: "nagad", openingBalancePaisa: 50_000 });
  });
});
