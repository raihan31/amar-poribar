import { render, screen } from "@testing-library/react";
import { vi } from "vitest";
import { InvitePreview, type InvitePreviewData } from "./InvitePreview";

const NOW = Date.parse("2026-11-01T00:00:00Z");
const data: InvitePreviewData = {
  familyName: "রহিম পরিবার",
  memberCount: 5,
  inviter: { id: "u1", name: "আব্বু" },
  role: "member",
  expiresAt: new Date(NOW + 6 * 86_400_000).toISOString(),
};

describe("InvitePreview", () => {
  it("shows days left in Bangla digits", () => {
    render(<InvitePreview data={data} now={NOW} onAccept={vi.fn()} onDecline={vi.fn()} />);
    expect(screen.getByText("আমন্ত্রণের মেয়াদ আছে আর ৬ দিন।")).toBeInTheDocument();
    expect(screen.getByText("আব্বু আপনাকে ডেকেছেন")).toBeInTheDocument();
    expect(screen.getByText(/৫ জন সদস্য/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "যোগ দিন" })).toBeInTheDocument();
  });
});
