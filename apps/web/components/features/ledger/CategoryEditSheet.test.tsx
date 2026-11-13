import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { CategoryEditSheet } from "./CategoryEditSheet";

const cat = { id: "c1", key: "bazaar", kind: "expense", nameBn: "বাজার", nameEn: "Bazaar", icon: "🛒" };

describe("CategoryEditSheet", () => {
  it("hide keeps category in old transactions", async () => {
    const onSave = vi.fn();
    render(<CategoryEditSheet open category={cat} kind="expense" onSave={onSave} onClose={() => {}} />);
    // Hiding is a PATCH of isHidden; there is no delete control, so old transactions keep their category.
    expect(screen.queryByRole("button", { name: /মুছ/ })).toBeNull();
    await userEvent.click(screen.getByRole("switch", { name: "লুকান" }));
    await userEvent.click(screen.getByRole("button", { name: "রাখুন" }));
    expect(onSave).toHaveBeenCalledTimes(1);
    expect(onSave.mock.calls[0]![0]).toEqual({ nameBn: "বাজার", nameEn: "Bazaar", icon: "🛒", isHidden: true });
  });

  it("creates with the chosen icon", async () => {
    const onSave = vi.fn();
    render(<CategoryEditSheet open category={null} kind="income" onSave={onSave} onClose={() => {}} />);
    await userEvent.type(screen.getByLabelText("বাংলা নাম"), "টিউশন");
    await userEvent.type(screen.getByLabelText("ইংরেজি নাম"), "Tuition");
    await userEvent.click(screen.getByRole("button", { name: "📚" }));
    await userEvent.click(screen.getByRole("button", { name: "রাখুন" }));
    expect(onSave).toHaveBeenCalledWith({ kind: "income", nameBn: "টিউশন", nameEn: "Tuition", icon: "📚" });
  });
});
