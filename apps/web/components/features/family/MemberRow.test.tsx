import { render, screen } from "@testing-library/react";
import { vi } from "vitest";
import { translate } from "@/lib/i18n/useT";
import { MemberRow, type FamilyMember } from "./MemberRow";

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }) }));

const buzz = translate("bn", "fam.buzz");
const video = translate("bn", "fam.video");
const chat = translate("bn", "fam.chat");

function row(member: FamilyMember) {
  return render(
    <ul>
      <MemberRow member={member} meId="u1" actorRole="owner" onRoleChange={() => {}} onRemove={() => {}} />
    </ul>,
  );
}

describe("MemberRow", () => {
  it("own row has no buzz button", () => {
    row({ userId: "u1", role: "owner", displayName: "আব্বু" });
    expect(screen.queryByRole("button", { name: buzz })).toBeNull();
    expect(screen.queryByRole("button", { name: chat })).toBeNull();
  });

  it("viewer row has video button", () => {
    row({ userId: "u9", role: "viewer", displayName: "তানভীর" });
    expect(screen.getByRole("button", { name: video })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: buzz })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: chat })).toBeNull();
  });

  it("member row has buzz and chat buttons", () => {
    row({ userId: "u2", role: "member", displayName: "দাদি" });
    expect(screen.getByRole("button", { name: buzz })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: chat })).toBeInTheDocument();
  });
});
