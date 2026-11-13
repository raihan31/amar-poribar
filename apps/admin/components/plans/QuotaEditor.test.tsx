import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { QuotaEditor } from "./QuotaEditor";

describe("QuotaEditor", () => {
  it("needs reason and positive integer", async () => {
    const onSave = vi.fn();
    render(<QuotaEditor value={100} onSave={onSave} />);
    const input = screen.getByLabelText("AI entries per month");
    const save = screen.getByRole("button", { name: "Save" });

    for (const bad of ["0", "12.5", "-3"]) {
      await userEvent.clear(input);
      await userEvent.type(input, bad);
      expect(save).toBeDisabled();
    }

    await userEvent.clear(input);
    await userEvent.type(input, "250");
    expect(save).toBeEnabled();
    await userEvent.click(save);
    const confirm = screen.getByRole("button", { name: "Save quota" });
    expect(confirm).toBeDisabled();
    await userEvent.type(screen.getByLabelText(/Reason/), "Pilot with a school group");
    await userEvent.click(confirm);
    expect(onSave).toHaveBeenCalledWith(250, "Pilot with a school group");
  });
});
