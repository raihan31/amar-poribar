import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { FamilyRow } from "./FamilyRow";

const members = [
  { userId: "u1", role: "admin" as const, name: "আম্মু", phone: "01700000001" },
  { userId: "u2", role: "member" as const, name: "দাদি", phone: "01700000002" },
];

describe("FamilyRow", () => {
  it("presence has word and aria-label", () => {
    render(<FamilyRow members={members} online={new Set(["u1"])} />);
    expect(screen.getByLabelText("আম্মু, অনলাইন")).toBeInTheDocument();
    expect(screen.getByLabelText("দাদি, অফলাইন")).toBeInTheDocument();
    expect(screen.getByText("অনলাইন")).toBeInTheDocument();
    expect(screen.getByText("অফলাইন")).toBeInTheDocument();
    expect(screen.getByText("সবুজ = অনলাইন / ধূসর = অফলাইন")).toBeInTheDocument();
  });
});
