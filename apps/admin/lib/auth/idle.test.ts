import { afterEach, describe, expect, it, vi } from "vitest";
import { startIdleWatch } from "./idle";

afterEach(() => vi.useRealTimers());

describe("idle watch", () => {
  it("warns at 28 minutes", () => {
    vi.useFakeTimers();
    const onWarn = vi.fn();
    const onSignOut = vi.fn();
    const w = startIdleWatch({ onWarn, onSignOut });
    vi.advanceTimersByTime(27 * 60 * 1000 + 59_000);
    expect(onWarn).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1000);
    expect(onWarn).toHaveBeenCalledOnce();
    expect(onSignOut).not.toHaveBeenCalled();
    vi.advanceTimersByTime(2 * 60 * 1000);
    expect(onSignOut).toHaveBeenCalledOnce();
    w.stop();
  });

  it("reset restarts the window", () => {
    vi.useFakeTimers();
    const onWarn = vi.fn();
    const w = startIdleWatch({ onWarn, onSignOut: vi.fn() });
    vi.advanceTimersByTime(20 * 60 * 1000);
    w.reset();
    vi.advanceTimersByTime(20 * 60 * 1000);
    expect(onWarn).not.toHaveBeenCalled();
    w.stop();
  });
});
