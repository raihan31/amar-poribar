import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { AddQuotaDialog } from "./AddQuotaDialog";
import { ChangePlanDialog } from "./ChangePlanDialog";
import { renderWithQuery } from "./family.test-utils";
import { TransferOwnershipDialog } from "./TransferOwnershipDialog";
import { familyFixture } from "./types";

describe("ChangePlanDialog", () => {
  it("posts plan and reason", async () => {
    const onDone = vi.fn();
    const posts = renderWithQuery(
      <ChangePlanDialog open familyId="fam_1" current="free" onDone={onDone} onCancel={() => {}} />,
    );
    await userEvent.selectOptions(screen.getByLabelText("Plan"), "plus");
    await userEvent.type(screen.getByLabelText(/Reason/), "upgrade after payment");
    await userEvent.click(screen.getByRole("button", { name: "Change plan" }));
    await waitFor(() => expect(onDone).toHaveBeenCalled());
    expect(posts).toEqual([{ action: "plan", body: { plan: "plus", reason: "upgrade after payment" } }]);
  });
});

describe("AddQuotaDialog", () => {
  it("posts add and reason, rejects out-of-range", async () => {
    const onDone = vi.fn();
    const posts = renderWithQuery(<AddQuotaDialog open familyId="fam_1" onDone={onDone} onCancel={() => {}} />);
    await userEvent.type(screen.getByLabelText(/Reason/), "pilot extension");
    const btn = screen.getByRole("button", { name: "Add entries" });
    const num = screen.getByLabelText("Entries to add (1 to 500)");
    await userEvent.clear(num);
    await userEvent.type(num, "501");
    expect(btn).toBeDisabled();
    await userEvent.clear(num);
    await userEvent.type(num, "50");
    await userEvent.click(btn);
    await waitFor(() => expect(onDone).toHaveBeenCalled());
    expect(posts).toEqual([{ action: "quota", body: { add: 50, reason: "pilot extension" } }]);
  });
});

describe("TransferOwnershipDialog", () => {
  it("posts toUserId and reason", async () => {
    const onDone = vi.fn();
    const posts = renderWithQuery(
      <TransferOwnershipDialog
        open
        familyId="fam_1"
        members={familyFixture().members}
        onDone={onDone}
        onCancel={() => {}}
      />,
    );
    await userEvent.selectOptions(screen.getByLabelText("New owner"), "u3");
    await userEvent.type(screen.getByLabelText(/Reason/), "owner lost phone");
    await userEvent.click(screen.getByRole("button", { name: "Transfer ownership" }));
    await waitFor(() => expect(onDone).toHaveBeenCalled());
    expect(posts).toEqual([{ action: "transfer-ownership", body: { toUserId: "u3", reason: "owner lost phone" } }]);
  });
});
