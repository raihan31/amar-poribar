import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { IncidentList } from "./IncidentList";
import { healthFixture } from "./types";

describe("IncidentList", () => {
  it("watching vs resolved", () => {
    render(<IncidentList incidents={healthFixture.incidents} />);
    expect(screen.getAllByText("Watching")).toHaveLength(1);
    expect(screen.getAllByText("Resolved")).toHaveLength(2);
    expect(screen.getByText("OTP delays on one gateway route")).toBeInTheDocument();
    expect(screen.getByText(/switched to backup route/)).toBeInTheDocument();
  });
});
