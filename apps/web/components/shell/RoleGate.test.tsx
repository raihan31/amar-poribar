import { render, screen } from "@testing-library/react";
import { FamilyContext, type FamilyValue } from "./useFamily";
import { RoleGate } from "./RoleGate";
import type { RoleName } from "@/lib/types";

function renderAs(role: RoleName, need: RoleName) {
  const value: FamilyValue = {
    family: { id: "f", name: "F", role },
    families: [],
    role,
    switchFamily: () => {},
    me: null,
  };
  return render(
    <FamilyContext.Provider value={value}>
      <RoleGate role={need}>
        <button>সংরক্ষণ</button>
      </RoleGate>
    </FamilyContext.Provider>,
  );
}

describe("RoleGate", () => {
  it("viewer sees read-only message", () => {
    renderAs("viewer", "member");
    expect(screen.getByText("আপনি শুধু দেখতে পারবেন।")).toBeInTheDocument();
    expect(screen.queryByRole("button")).toBeNull();
  });

  it("member passes member gate", () => {
    renderAs("member", "member");
    expect(screen.getByRole("button")).toBeInTheDocument();
  });
});
