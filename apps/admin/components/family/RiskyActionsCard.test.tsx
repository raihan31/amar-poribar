import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { renderWithQuery } from "./family.test-utils";
import { RiskyActionsCard } from "./RiskyActionsCard";

const NAME = "রহিম পরিবার";

describe("RiskyActionsCard", () => {
  it("delete needs reason, typed name and checkbox", async () => {
    const onDone = vi.fn();
    const posts = renderWithQuery(
      <RiskyActionsCard familyId="fam_1" familyName={NAME} status="active" staffRole="owner" onDone={onDone} />,
    );
    await userEvent.click(screen.getByRole("button", { name: "Delete family and data…" }));
    const dlg = within(screen.getByRole("dialog", { name: "Delete family and data" }));
    const confirm = dlg.getByRole("button", { name: "Delete family" });
    expect(confirm).toBeDisabled();
    await userEvent.type(dlg.getByLabelText(/Reason/), "owner asked by phone");
    expect(confirm).toBeDisabled();
    await userEvent.type(dlg.getByLabelText("Type the family name to confirm"), NAME);
    expect(confirm).toBeDisabled();
    await userEvent.click(dlg.getByLabelText("I understand this starts the 30-day deletion process"));
    expect(confirm).toBeEnabled();
    await userEvent.click(confirm);
    await waitFor(() => expect(onDone).toHaveBeenCalled());
    expect(posts).toEqual([{ action: "delete", body: { reason: "owner asked by phone", confirmFamilyName: NAME } }]);
  });

  it("support sees no suspend or delete", () => {
    renderWithQuery(
      <RiskyActionsCard familyId="fam_1" familyName={NAME} status="active" staffRole="support" onDone={() => {}} />,
    );
    expect(screen.queryByRole("button", { name: /Suspend/ })).toBeNull();
    expect(screen.queryByRole("button", { name: /Delete/ })).toBeNull();
  });

  it("suspended family offers unsuspend", () => {
    renderWithQuery(
      <RiskyActionsCard familyId="fam_1" familyName={NAME} status="suspended" staffRole="owner" onDone={() => {}} />,
    );
    expect(screen.getByRole("button", { name: "Unsuspend family" })).toBeInTheDocument();
  });
});
