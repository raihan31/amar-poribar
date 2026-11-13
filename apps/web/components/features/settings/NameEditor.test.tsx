import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { NameEditor } from "./NameEditor";

describe("NameEditor", () => {
  it("saves the trimmed new name and closes", async () => {
    const onSave = vi.fn().mockResolvedValue(undefined);
    render(<NameEditor name="আব্বু" onSave={onSave} />);
    await userEvent.click(screen.getByRole("button", { name: "বদলান" }));
    const field = screen.getByLabelText("নাম");
    await userEvent.clear(field);
    await userEvent.type(field, "  রহিম ");
    await userEvent.click(screen.getByRole("button", { name: "রাখুন" }));
    expect(onSave).toHaveBeenCalledWith("রহিম");
    expect(screen.queryByLabelText("নাম")).toBeNull();
  });

  it("stays open with an alert when saving fails", async () => {
    render(<NameEditor name="আব্বু" onSave={() => Promise.reject(new Error("x"))} />);
    await userEvent.click(screen.getByRole("button", { name: "বদলান" }));
    await userEvent.type(screen.getByLabelText("নাম"), "২");
    await userEvent.click(screen.getByRole("button", { name: "রাখুন" }));
    expect(await screen.findByRole("alert")).toBeInTheDocument();
    expect(screen.getByLabelText("নাম")).toBeInTheDocument();
  });
});
