import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { RejectDialog } from "./RejectDialog";

describe("RejectDialog", () => {
  it("reason required", async () => {
    const onConfirm = vi.fn();
    render(<RejectDialog open requestId="#PR-0188" onConfirm={onConfirm} onCancel={() => {}} />);
    const btn = screen.getByRole("button", { name: "Reject request" });
    expect(btn).toBeDisabled();
    await userEvent.type(screen.getByLabelText(/Reason/), "short");
    expect(btn).toBeDisabled();
    await userEvent.type(screen.getByLabelText(/Reason/), " but long enough");
    expect(btn).toBeEnabled();
    await userEvent.click(btn);
    expect(onConfirm).toHaveBeenCalledWith("short but long enough");
  });
});
