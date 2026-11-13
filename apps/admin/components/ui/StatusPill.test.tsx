import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { StatusPill } from "./StatusPill";

describe("StatusPill", () => {
  it("always has text and an icon for ok/warn/risk", () => {
    for (const kind of ["ok", "warn", "risk", "info"] as const) {
      const { unmount } = render(<StatusPill kind={kind}>Label {kind}</StatusPill>);
      expect(screen.getByText(`Label ${kind}`)).toBeInTheDocument();
      expect(screen.getByTestId("pill-icon").textContent).toMatch(/\S/);
      unmount();
    }
  });
  it("neutral is text only", () => {
    render(<StatusPill kind="neutral">Plain</StatusPill>);
    expect(screen.queryByTestId("pill-icon")).toBeNull();
  });
});
