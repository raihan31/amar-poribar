import { act, render, screen } from "@testing-library/react";
import { setOutboxCount } from "@/lib/outbox/useOutboxCount";
import { notifyNetworkError, notifyNetworkOk } from "@/lib/api/network";
import { OfflineBanner } from "./OfflineBanner";

function setOnline(v: boolean) {
  vi.spyOn(navigator, "onLine", "get").mockReturnValue(v);
  window.dispatchEvent(new Event(v ? "online" : "offline"));
}

describe("OfflineBanner", () => {
  afterEach(() => {
    act(() => {
      setOutboxCount("chat", 0);
      setOutboxCount("entry", 0);
      notifyNetworkOk();
      setOnline(true);
    });
  });

  it("is hidden while online", () => {
    render(<OfflineBanner />);
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("shows queued count", () => {
    render(<OfflineBanner />);
    act(() => {
      setOutboxCount("chat", 2);
      setOutboxCount("entry", 1);
      setOnline(false);
    });
    expect(screen.getByRole("alert")).toHaveTextContent("ইন্টারনেট নেই। আপনার লেখা জমা থাকবে।");
    expect(screen.getByRole("alert")).toHaveTextContent("৩");
  });

  it("appears on API network errors", () => {
    render(<OfflineBanner />);
    act(() => notifyNetworkError());
    expect(screen.getByRole("alert")).toBeInTheDocument();
  });
});
