import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { EnrollTotp, groupSecret } from "./EnrollTotp";

vi.mock("@/lib/auth/qr", () => ({ drawQr: vi.fn(async () => {}) }));

describe("EnrollTotp", () => {
  it("groups secret by four", () => {
    expect(groupSecret("JBSWY3DPEHPK3PXP")).toBe("JBSW Y3DP EHPK 3PXP");
    expect(groupSecret("ABCDEF")).toBe("ABCD EF");
  });

  it("shows secret in groups of four and confirms with code", async () => {
    const onConfirm = vi.fn();
    render(
      <EnrollTotp
        otpauthUri="otpauth://totp/x?secret=JBSWY3DPEHPK3PXP"
        secret="JBSWY3DPEHPK3PXP"
        onConfirm={onConfirm}
      />,
    );
    expect(screen.getByText("JBSW Y3DP EHPK 3PXP")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Copy" })).toBeInTheDocument();
    const confirm = screen.getByRole("button", { name: "Confirm and sign in" });
    expect(confirm).toBeDisabled();
    await userEvent.click(screen.getAllByRole("textbox")[0]!);
    await userEvent.paste("123456");
    await userEvent.click(confirm);
    expect(onConfirm).toHaveBeenCalledWith("123456");
  });
});
