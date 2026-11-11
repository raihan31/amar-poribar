import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ConsentList } from "./ConsentList";

function setup(onSubmit = vi.fn()) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={qc}>
      <ConsentList onSubmit={onSubmit} />
    </QueryClientProvider>,
  );
  return onSubmit;
}

describe("ConsentList", () => {
  it("submit disabled until I agree", async () => {
    const onSubmit = setup();
    const submit = screen.getByRole("button", { name: "পরিবার তৈরি করুন" });
    await userEvent.type(screen.getByPlaceholderText("যেমন: রহিম পরিবার"), "রহিম পরিবার");
    expect(submit).toHaveAttribute("aria-disabled", "true");
    await userEvent.click(submit);
    expect(onSubmit).not.toHaveBeenCalled();
    await userEvent.click(screen.getByRole("checkbox", { name: "আমি রাজি আছি" }));
    expect(submit).not.toHaveAttribute("aria-disabled");
    await userEvent.click(submit);
    expect(onSubmit).toHaveBeenCalledWith("রহিম পরিবার");
  });
});
