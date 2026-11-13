import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { ReasonDialog } from "./ReasonDialog";

describe("ReasonDialog", () => {
  it("needs 10 characters", async () => {
    const onConfirm = vi.fn();
    render(<ReasonDialog open title="Change plan" onConfirm={onConfirm} onCancel={() => {}} />);
    const btn = screen.getByRole("button", { name: "Confirm" });
    const box = screen.getByLabelText("Reason (required, at least 10 characters)");
    expect(btn).toBeDisabled();
    await userEvent.type(box, "123456789");
    expect(btn).toBeDisabled();
    expect(screen.getByText("9 / 10")).toBeInTheDocument();
    await userEvent.type(box, "0");
    expect(btn).toBeEnabled();
    await userEvent.click(btn);
    expect(onConfirm).toHaveBeenCalledWith("1234567890");
  });
});
