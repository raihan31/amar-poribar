import { act, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { LockoutNotice, formatClock } from "./LockoutNotice";

describe("LockoutNotice", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("formats mm:ss", () => {
    expect(formatClock(872)).toBe("14:32");
    expect(formatClock(5)).toBe("0:05");
  });

  it("counts down and re-enables form", () => {
    const onExpire = vi.fn();
    render(<LockoutNotice retryAfterSeconds={3} onExpire={onExpire} />);
    expect(screen.getByRole("alert")).toHaveTextContent("Try again in 0:03");
    act(() => void vi.advanceTimersByTime(1000));
    expect(screen.getByRole("alert")).toHaveTextContent("Try again in 0:02");
    expect(onExpire).not.toHaveBeenCalled();
    act(() => void vi.advanceTimersByTime(2000));
    expect(onExpire).toHaveBeenCalledTimes(1);
  });
});
