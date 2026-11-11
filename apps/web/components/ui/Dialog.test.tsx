import { fireEvent, render, screen } from "@testing-library/react";
import { Dialog } from "./Dialog";

describe("Dialog", () => {
  it("Escape closes unless blocking", () => {
    const onClose = vi.fn();
    const { rerender } = render(
      <Dialog open onClose={onClose} title="শিরোনাম" closeLabel="বন্ধ">
        <button>ঠিক</button>
      </Dialog>,
    );
    fireEvent.keyDown(screen.getByRole("dialog", { hidden: true }), { key: "Escape" });
    expect(onClose).toHaveBeenCalledTimes(1);
    rerender(
      <Dialog open onClose={onClose} title="শিরোনাম" closeLabel="বন্ধ" blocking>
        <button>ঠিক</button>
      </Dialog>,
    );
    fireEvent.keyDown(screen.getByRole("dialog", { hidden: true }), { key: "Escape" });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("traps Tab focus inside", () => {
    render(
      <Dialog open onClose={() => {}} title="শিরোনাম" closeLabel="বন্ধ">
        <button>শেষ</button>
      </Dialog>,
    );
    const last = screen.getByText("শেষ", { selector: "button" });
    last.focus();
    fireEvent.keyDown(screen.getByRole("dialog", { hidden: true }), { key: "Tab" });
    expect(screen.getByRole("button", { name: "বন্ধ", hidden: true })).toHaveFocus();
  });
});
