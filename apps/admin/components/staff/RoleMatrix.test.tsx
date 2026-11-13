import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { PERMISSION_ROWS, ROLE_LABEL, STAFF_ROLES, can } from "@/lib/permissions";
import { RoleMatrix } from "./RoleMatrix";

describe("RoleMatrix", () => {
  it("matrix equals permissions.ts", () => {
    render(<RoleMatrix />);
    for (const row of PERMISSION_ROWS) {
      const tr = screen.getByText(row.label).closest("tr")!;
      const cells = within(tr).getAllByRole("cell");
      STAFF_ROLES.forEach((r, i) => expect(cells[i]).toHaveTextContent(can(r, row.action) ? "✓ Yes" : "✗ No"));
    }
    expect(screen.getByText(ROLE_LABEL.readonly)).toBeInTheDocument();
    expect(screen.getByText("No role can see transactions, notes, chat, voice or video.")).toBeInTheDocument();
  });
});
