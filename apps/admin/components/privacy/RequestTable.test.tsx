import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { privacyFixture } from "@/mocks/fixtures";
import { RequestTable } from "./RequestTable";

const now = new Date("2026-11-11T00:00:00Z");
const noop = () => {};

describe("RequestTable", () => {
  it("act now when ≤ 5 days", () => {
    render(<RequestTable items={privacyFixture(now).items} now={now} onSelect={noop} onContinue={noop} />);
    expect(screen.getAllByRole("button", { name: "Act now" })).toHaveLength(1);
    expect(screen.getAllByRole("button", { name: "Continue" })).toHaveLength(2);
    expect(screen.getByText("18 days left")).toBeInTheDocument();
    expect(screen.getByText("5 days left")).toBeInTheDocument();
  });

  it("read-only has no action buttons", () => {
    render(
      <RequestTable items={privacyFixture(now).items} now={now} canAct={false} onSelect={noop} onContinue={noop} />,
    );
    expect(screen.queryByRole("button", { name: "Continue" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Act now" })).toBeNull();
  });
});
