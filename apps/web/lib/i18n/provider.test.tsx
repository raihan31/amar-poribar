import { describe, expect, it } from "vitest";
import { render, screen, act } from "@testing-library/react";
import { bn, en } from "@amar-poribar/shared";
import { webBn, webEn } from "./web-strings";
import { I18nProvider, useI18n } from "./provider";
import { useT } from "./useT";

function Labels() {
  const t = useT();
  const { setPreference } = useI18n();
  return (
    <div>
      <span data-testid="a">{t("login.prompt")}</span>
      <span data-testid="b">{t("budgets")}</span>
      <button onClick={() => setPreference({ locale: "en", simple: true })}>go</button>
    </div>
  );
}

describe("I18nProvider", () => {
  it("toggling language changes every label under the provider", () => {
    render(
      <I18nProvider initial={{ locale: "bn", numerals: "bn", simple: false }}>
        <Labels />
      </I18nProvider>,
    );
    expect(screen.getByTestId("a")).toHaveTextContent(webBn["login.prompt"]);
    expect(screen.getByTestId("b")).toHaveTextContent(bn.budgets);
    act(() => screen.getByText("go").click());
    expect(screen.getByTestId("a")).toHaveTextContent(webEn["login.prompt"]);
    expect(screen.getByTestId("b")).toHaveTextContent(en.budgets);
    expect(document.documentElement.getAttribute("data-simple")).toBe("1");
    expect(document.documentElement.lang).toBe("en");
  });
});
