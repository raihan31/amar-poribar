import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { InviteStaffForm } from "./InviteStaffForm";

describe("InviteStaffForm", () => {
  it("invalid email rejected", async () => {
    const onInvite = vi.fn();
    render(<InviteStaffForm onInvite={onInvite} />);
    await userEvent.type(screen.getByLabelText("Work email"), "not-an-email");
    await userEvent.click(screen.getByRole("button", { name: "Send invite" }));
    expect(onInvite).not.toHaveBeenCalled();
    expect(screen.getByText("Enter a valid work email")).toBeInTheDocument();
  });

  it("valid email sends role", async () => {
    const onInvite = vi.fn();
    render(<InviteStaffForm onInvite={onInvite} />);
    await userEvent.type(screen.getByLabelText("Work email"), "a@amarporibar.example");
    await userEvent.click(screen.getByRole("button", { name: "Send invite" }));
    expect(onInvite).toHaveBeenCalledWith({ email: "a@amarporibar.example", role: "support" });
  });
});
