import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { I18nProvider } from "@/lib/i18n/provider";
import { DEFAULT_PREFS } from "@/lib/i18n/cookie";
import { LanguageChoice } from "./LanguageChoice";
import { NumeralChoice } from "./NumeralChoice";
import { SimpleModeToggle } from "./SimpleModeToggle";

function setup() {
  return render(
    <I18nProvider initial={DEFAULT_PREFS}>
      <LanguageChoice />
      <NumeralChoice />
      <SimpleModeToggle />
    </I18nProvider>,
  );
}

describe("LanguageChoice", () => {
  it("switching to English updates labels", async () => {
    setup();
    expect(screen.getByRole("radiogroup", { name: "ভাষা · Language" })).toBeInTheDocument();
    expect(screen.getByRole("radio", { name: "বাংলা" })).toHaveAttribute("aria-checked", "true");
    await userEvent.click(screen.getByRole("radio", { name: "English" }));
    expect(screen.getByRole("radiogroup", { name: "Language" })).toBeInTheDocument();
    expect(screen.getByText("Simple mode")).toBeInTheDocument();
    expect(document.cookie).toContain("ap_loc=en");
  });

  it("numerals and simple mode write cookies", async () => {
    setup();
    await userEvent.click(screen.getByRole("radio", { name: "123" }));
    await userEvent.click(screen.getByRole("switch"));
    expect(document.cookie).toContain("ap_num=latn");
    expect(document.cookie).toContain("ap_simple=1");
  });
});
