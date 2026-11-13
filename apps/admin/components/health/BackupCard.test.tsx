import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { BackupCard } from "./BackupCard";
import { healthFixture } from "./types";

describe("BackupCard", () => {
  it("shows weekly cadence", () => {
    render(<BackupCard backups={healthFixture.backups} />);
    expect(screen.getByText("weekly (automated)")).toBeInTheDocument();
    expect(screen.getByText(/due 16 Nov 2026/)).toBeInTheDocument();
    expect(screen.queryByText(/quarter/i)).toBeNull();
    expect(screen.getByText("14 days")).toBeInTheDocument();
    expect(screen.getByText(/✓ Passed/)).toBeInTheDocument();
  });
});
