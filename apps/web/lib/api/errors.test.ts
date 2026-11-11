import { beforeEach, describe, expect, it, vi } from "vitest";
import { ApiProblem, isSessionExpired, notifySessionExpired, onSessionExpired } from "./errors";

describe("session expiry", () => {
  beforeEach(() => onSessionExpired(null));

  it("session_expired triggers redirect once", () => {
    const redirect = vi.fn();
    onSessionExpired(redirect);
    const p = new ApiProblem(401, "session_expired", "Session expired");
    expect(isSessionExpired(p)).toBe(true);
    notifySessionExpired(p);
    notifySessionExpired(p);
    expect(redirect).toHaveBeenCalledTimes(1);
  });

  it("ignores other problems", () => {
    const redirect = vi.fn();
    onSessionExpired(redirect);
    notifySessionExpired(new ApiProblem(403, "forbidden", "No"));
    expect(redirect).not.toHaveBeenCalled();
  });
});
