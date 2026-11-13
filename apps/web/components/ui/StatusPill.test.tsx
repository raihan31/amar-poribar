import { render, screen } from "@testing-library/react";
import { StatusPill, type StatusLevel } from "./StatusPill";

describe("StatusPill", () => {
  it("renders icon, word and class for each level", () => {
    const levels: StatusLevel[] = ["ok", "warn", "danger", "info"];
    for (const level of levels) {
      const { container, unmount } = render(<StatusPill level={level}>শব্দ-{level}</StatusPill>);
      expect(screen.getByText(`শব্দ-${level}`)).toBeInTheDocument();
      expect(container.querySelector("svg")).not.toBeNull();
      expect(container.firstElementChild).toHaveClass(`ui-pill--${level}`);
      unmount();
    }
  });
});
