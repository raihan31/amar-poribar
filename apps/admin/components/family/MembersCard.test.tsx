import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { MembersCard } from "./MembersCard";
import { familyFixture } from "./types";

describe("MembersCard", () => {
  it("phones are masked", () => {
    const f = familyFixture();
    const { container } = render(
      <MembersCard members={f.members} pendingInvites={f.pendingInvites} canTransfer onTransfer={() => {}} />,
    );
    expect(screen.getByText("••• 678")).toBeInTheDocument();
    expect(container.textContent).not.toMatch(/\+?8801\d{9}|01\d{9}/);
    expect(screen.getByText("Members (4)")).toBeInTheDocument();
    expect(screen.getByText(/••• 432 · 6 days left/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Transfer ownership…" })).toBeInTheDocument();
  });

  it("read-only has no transfer button", () => {
    render(<MembersCard members={[]} pendingInvites={[]} canTransfer={false} readOnly onTransfer={() => {}} />);
    expect(screen.queryByRole("button")).toBeNull();
    expect(screen.getByText("You have read-only access.")).toBeInTheDocument();
  });
});
