import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { NeedsAttention } from "./NeedsAttention";
import { overviewFixture as f } from "./types";

describe("NeedsAttention", () => {
  it("links carry filters", () => {
    render(<NeedsAttention items={f.needsAttention} />);
    expect(screen.getByText("7 families used 90%+ of AI quota")).toBeInTheDocument();
    expect(screen.getByText("OTP delivery failures: 4.2% today")).toBeInTheDocument();
    expect(screen.getByText("2 families have no active owner")).toBeInTheDocument();
    const hrefs = screen.getAllByRole("link").map((a) => a.getAttribute("href"));
    expect(hrefs).toEqual(["/families?quota=over90", "/health", "/families?status=no_owner"]);
  });
});
