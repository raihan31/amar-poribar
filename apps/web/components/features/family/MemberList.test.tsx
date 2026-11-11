import { render, screen } from "@testing-library/react";
import { t } from "@amar-poribar/shared";
import { http, HttpResponse } from "msw";
import { describe, expect, it } from "vitest";
import { server } from "@/mocks/server";
import type { Family } from "@/lib/types";
import { MemberList } from "./MemberList";

const members = [
  { userId: "u1", role: "owner", name: "Owner", phone: "01700000001" },
  { userId: "u2", role: "admin", name: "Other Admin", phone: "01700000002" },
  { userId: "u3", role: "member", name: "Kid", phone: "01700000003" },
];

function setup(role: Family["role"], meId: string) {
  server.use(http.get("http://localhost:3000/api/proxy/v1/families/f1/members", () => HttpResponse.json(members)));
  render(<MemberList family={{ id: "f1", name: "F", role }} meId={meId} onError={() => {}} onLeft={() => {}} />);
}

describe("MemberList", () => {
  it("only owner can change admin role", async () => {
    setup("owner", "u1");
    await screen.findByText("Other Admin");
    // owner may change the admin and the member
    expect(screen.getAllByRole("combobox", { name: t("members") })).toHaveLength(2);
  });

  it("an admin cannot change another admin", async () => {
    setup("admin", "u9");
    await screen.findByText("Other Admin");
    // only the plain member is editable, the other admin is shown as text
    expect(screen.getAllByRole("combobox", { name: t("members") })).toHaveLength(1);
    expect(screen.getByText(t("roleAdmin"))).toBeInTheDocument();
  });
});
