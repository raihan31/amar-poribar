import { act, renderHook } from "@testing-library/react";
import { useOnline } from "./useOnline";

describe("useOnline", () => {
  it("reflects window online/offline events", () => {
    const { result } = renderHook(() => useOnline());
    expect(result.current).toBe(true);
    act(() => {
      vi.spyOn(navigator, "onLine", "get").mockReturnValue(false);
      window.dispatchEvent(new Event("offline"));
    });
    expect(result.current).toBe(false);
    act(() => {
      vi.spyOn(navigator, "onLine", "get").mockReturnValue(true);
      window.dispatchEvent(new Event("online"));
    });
    expect(result.current).toBe(true);
  });
});
