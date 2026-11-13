import { render, screen } from "@testing-library/react";
import { AccountCard } from "./AccountCard";

describe("AccountCard", () => {
  it("shows balance in Bangla digits", () => {
    render(
      <AccountCard
        account={{ id: "a1", name: "ব্যাংক", type: "bank", balancePaisa: 9_500_000 }}
        ownerName={null}
        canEdit={false}
        onArchive={() => {}}
      />,
    );
    expect(screen.getByText("৳ ৯৫,০০০")).toBeInTheDocument();
    expect(screen.getByText("সবার জন্য")).toBeInTheDocument();
  });

  it("shows the owner and offers archive to editors", () => {
    render(
      <AccountCard
        account={{ id: "a2", name: "বিকাশ", type: "bkash", balancePaisa: 1_230_000, ownerUserId: "u2" }}
        ownerName="আম্মু"
        canEdit
        onArchive={() => {}}
      />,
    );
    expect(screen.getByText("মালিক: আম্মু")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /বন্ধ করুন/ })).toBeInTheDocument();
  });
});
