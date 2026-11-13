import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import ErrorPage from "./error";
import AppError from "./(app)/error";

describe("error boundaries", () => {
  it("retry button calls reset", async () => {
    const reset = vi.fn();
    render(<ErrorPage error={new Error("x")} reset={reset} />);
    expect(screen.getByText("একটু সমস্যা হয়েছে। আবার চেষ্টা করুন।")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "আবার চেষ্টা" }));
    expect(reset).toHaveBeenCalledTimes(1);
  });

  it("app segment error also retries", async () => {
    const reset = vi.fn();
    render(<AppError error={new Error("x")} reset={reset} />);
    await userEvent.click(screen.getByRole("button", { name: "আবার চেষ্টা" }));
    expect(reset).toHaveBeenCalledTimes(1);
  });
});
