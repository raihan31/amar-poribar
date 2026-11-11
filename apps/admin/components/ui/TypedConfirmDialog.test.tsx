import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { TypedConfirmDialog } from "./TypedConfirmDialog";

describe("TypedConfirmDialog", () => {
  it("exact Bangla name required", async () => {
    render(
      <TypedConfirmDialog
        open
        title="Delete"
        expected="রহিম পরিবার"
        confirmLabel="Delete"
        onConfirm={() => {}}
        onCancel={() => {}}
      />,
    );
    const btn = screen.getByRole("button", { name: "Delete" });
    await userEvent.type(screen.getByLabelText("Reason (required, at least 10 characters)"), "duplicate account");
    const name = screen.getByLabelText("Type the family name to confirm");
    await userEvent.type(name, "রহিম পরিবার ");
    expect(btn).toBeDisabled();
    await userEvent.clear(name);
    await userEvent.type(name, "রহিম");
    expect(btn).toBeDisabled();
    await userEvent.clear(name);
    await userEvent.type(name, "রহিম পরিবার");
    expect(btn).toBeEnabled();
  });
});
