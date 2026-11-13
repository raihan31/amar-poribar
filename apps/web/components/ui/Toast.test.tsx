import { act, render, screen } from "@testing-library/react";
import { Toast } from "./Toast";

describe("Toast", () => {
  it("announces and auto-dismisses", () => {
    vi.useFakeTimers();
    const onDone = vi.fn();
    render(<Toast message="জমা হয়েছে" onDone={onDone} duration={1000} />);
    expect(screen.getByRole("status")).toHaveTextContent("জমা হয়েছে");
    act(() => {
      vi.advanceTimersByTime(1000);
    });
    expect(onDone).toHaveBeenCalled();
    vi.useRealTimers();
  });
});
