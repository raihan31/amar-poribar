import { render, screen } from "@testing-library/react";
import { fireEvent } from "@testing-library/react";
import { I18nProvider } from "@/lib/i18n/provider";
import { QuietHoursRow } from "./QuietHoursRow";

function setup(onChange = vi.fn()) {
  render(
    <I18nProvider initial={{ locale: "bn", numerals: "bn", simple: false }}>
      <QuietHoursRow start="22:00" end="06:00" onChange={onChange} />
    </I18nProvider>,
  );
  return onChange;
}

describe("QuietHoursRow", () => {
  it("default 22:00–06:00 shown in Bangla digits", () => {
    setup();
    expect(screen.getByText("রাত ১০টা থেকে সকাল ৬টা চুপ")).toBeInTheDocument();
    expect(screen.getByText("২২:০০ – ০৬:০০")).toBeInTheDocument();
  });

  it("changing the end time reports the new value", () => {
    const onChange = setup();
    fireEvent.change(screen.getByLabelText("চুপ শেষ"), { target: { value: "07:30" } });
    expect(onChange).toHaveBeenLastCalledWith({ quietEnd: "07:30" });
  });
});
