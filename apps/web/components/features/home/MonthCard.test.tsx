import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { MonthSummary } from "@amar-poribar/shared";
import { describe, expect, it, vi } from "vitest";
import { translate } from "@/lib/i18n/useT";
import { MonthCard } from "./MonthCard";

const speak = vi.fn();
vi.mock("@/lib/speech/useSpeak", () => ({ useSpeak: () => ({ speak, stop: vi.fn(), speaking: false }) }));

const base: MonthSummary = {
  month: "2026-11",
  incomePaisa: 0,
  expensePaisa: 4_250_000,
  previous: { month: "2026-10", incomePaisa: 0, expensePaisa: 3_930_000 },
  byCategory: [],
  byMember: [],
  byAccount: [],
};

describe("MonthCard", () => {
  it("change line uses more/less words and colour", () => {
    const { container, rerender } = render(<MonthCard summary={base} />);
    expect(screen.getByText("নভেম্বরে খরচ")).toBeInTheDocument();
    expect(screen.getByText(translate("bn", "home.moreThanLast", { amount: "৳ ৩,২০০" }))).toBeInTheDocument();
    expect(container.querySelector(".home-delta")).toHaveClass("home-delta--up");
    rerender(<MonthCard summary={{ ...base, expensePaisa: 3_000_000 }} />);
    expect(screen.getByText(/কম$/)).toBeInTheDocument();
    expect(container.querySelector(".home-delta")).toHaveClass("home-delta--down");
  });

  it("listen speaks speechText", async () => {
    render(<MonthCard summary={base} speechText="এই মাসে খরচ বেশি।" />);
    await userEvent.click(screen.getByRole("button", { name: "শুনুন" }));
    expect(speak).toHaveBeenCalledWith("এই মাসে খরচ বেশি।", { interrupt: true });
  });
});
