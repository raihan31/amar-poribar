import { useState } from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { TotpInput } from "./TotpInput";

function Harness() {
  const [v, setV] = useState("");
  return <TotpInput label="Code" value={v} onChange={setV} />;
}

describe("TotpInput", () => {
  it("paste fills six boxes", async () => {
    render(<Harness />);
    const boxes = screen.getAllByRole("textbox");
    expect(boxes).toHaveLength(6);
    await userEvent.click(boxes[0]!);
    await userEvent.paste("482 913");
    boxes.forEach((b, i) => expect(b).toHaveValue("482913"[i]!));
  });

  it("typing advances focus and backspace goes back", async () => {
    render(<Harness />);
    const boxes = screen.getAllByRole("textbox");
    await userEvent.click(boxes[0]!);
    await userEvent.keyboard("12");
    expect(boxes[2]).toHaveFocus();
    await userEvent.keyboard("{Backspace}");
    expect(boxes[1]).toHaveFocus();
    expect(boxes[1]).toHaveValue("");
  });
});
