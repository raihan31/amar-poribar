import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { translate } from "@/lib/i18n/useT";
import { ListenButton } from "./ListenButton";

const speech = "মোট খরচ বিয়াল্লিশ হাজার পাঁচশো টাকা।";

describe("ListenButton", () => {
  beforeEach(() => {
    vi.stubGlobal(
      "SpeechSynthesisUtterance",
      class {
        constructor(public text: string) {}
      },
    );
  });

  it("speaks speechText and toggles to stop", async () => {
    render(<ListenButton speechText={speech} />);
    await userEvent.click(screen.getByRole("button", { name: translate("bn", "speak") }));
    await waitFor(() => expect(globalThis.__spoken).toContain(speech));
    expect(await screen.findByRole("button", { name: translate("bn", "stop") })).toBeInTheDocument();
  });

  it("auto-speaks once when asked to", async () => {
    const { rerender } = render(<ListenButton speechText={speech} autoSpeak />);
    await waitFor(() => expect(globalThis.__spoken).toEqual([speech]));
    rerender(<ListenButton speechText={speech} autoSpeak />);
    expect(globalThis.__spoken).toEqual([speech]);
  });
});
