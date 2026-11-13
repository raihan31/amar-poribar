import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { http, HttpResponse } from "msw";
import { vi } from "vitest";
import { server } from "@/mocks/server";
import { FamilyContext, type FamilyValue } from "@/components/shell/useFamily";
import { translate } from "@/lib/i18n/useT";
import type { RoleName } from "@/lib/types";
import FamilyPage from "./page";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), back: vi.fn() }),
}));

const members = [
  { userId: "u1", role: "owner", name: "Owner", displayName: "Owner", phone: "01700000001" },
  { userId: "u2", role: "admin", name: "Other Admin", displayName: "Other Admin", phone: "01700000002" },
  { userId: "u3", role: "member", name: "Kid", displayName: "Kid", phone: "01700000003" },
];
const T = (k: Parameters<typeof translate>[1], v?: Record<string, string | number>) => translate("bn", k, v);

function setup(role: RoleName, meId: string) {
  server.use(
    http.get("*/api/proxy/v1/families/f1/members", () => HttpResponse.json(members)),
    http.get("*/api/proxy/v1/families/f1/invites", () =>
      role === "owner" || role === "admin" ? HttpResponse.json([]) : new HttpResponse(null, { status: 403 }),
    ),
  );
  const family = { id: "f1", name: "রহিম পরিবার", role };
  const value: FamilyValue = { family, families: [family], role, switchFamily: () => {}, me: { id: meId } };
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <FamilyContext.Provider value={value}>
        <FamilyPage />
      </FamilyContext.Provider>
    </QueryClientProvider>,
  );
}

describe("family page", () => {
  it("owner can change the admin and the member", async () => {
    setup("owner", "u1");
    await screen.findByRole("img", { name: "Other Admin" });
    expect(screen.getAllByRole("combobox", { name: /-এর ভূমিকা/ })).toHaveLength(2);
  });

  it("admin cannot change another admin", async () => {
    setup("admin", "u9");
    await screen.findByRole("img", { name: "Other Admin" });
    // only the plain member is editable; the other admin is shown as a pill
    expect(screen.getAllByRole("combobox", { name: /-এর ভূমিকা/ })).toHaveLength(1);
    expect(screen.getByText(T("roleAdmin"))).toBeInTheDocument();
    // admins may only assign member or viewer
    const options = within(screen.getByRole("combobox"))
      .getAllByRole("option")
      .map((o) => o.textContent);
    expect(options).toEqual([T("roleMember"), T("roleViewer")]);
  });

  it("member sees no management controls", async () => {
    setup("member", "u3");
    await screen.findByRole("img", { name: "Other Admin" });
    expect(screen.queryByRole("combobox")).toBeNull();
    expect(screen.queryByText(T("fam.invitePhone"))).toBeNull();
    expect(screen.getByRole("button", { name: T("leave") })).toBeInTheDocument();
  });

  it("removing a member asks first", async () => {
    let deleted = false;
    server.use(
      http.delete("*/api/proxy/v1/families/f1/members/u3", () => {
        deleted = true;
        return new HttpResponse(null, { status: 204 });
      }),
    );
    setup("owner", "u1");
    await userEvent.click(await screen.findByRole("button", { name: T("fam.removeMember", { name: "Kid" }) }));
    expect(deleted).toBe(false);
    await userEvent.click(await screen.findByRole("button", { name: T("fam.yes") }));
    await waitFor(() => expect(deleted).toBe(true));
  });

  it("plan limit opens plans dialog", async () => {
    server.use(
      http.post("*/api/proxy/v1/families/f1/invites", () =>
        HttpResponse.json({ error: { code: "plan_member_limit", message: "limit" } }, { status: 402 }),
      ),
    );
    setup("owner", "u1");
    await userEvent.click(await screen.findByRole("button", { name: T("fam.inviteLink") }));
    const link = await screen.findByRole("link", { name: T("fam.limitLink") });
    expect(link).toHaveAttribute("href", "/plans");
  });

  it("owner transfers ownership to an admin", async () => {
    let body: unknown;
    server.use(
      http.post("*/api/proxy/v1/families/f1/transfer-ownership", async ({ request }) => {
        body = await request.json();
        return HttpResponse.json({ ok: true });
      }),
    );
    setup("owner", "u1");
    await userEvent.click(await screen.findByRole("button", { name: T("fam.transfer") }));
    expect(screen.getByText(T("fam.transferNote"))).toBeInTheDocument();
    await userEvent.click(screen.getAllByRole("button", { name: T("fam.transfer") }).at(-1)!);
    await waitFor(() => expect(body).toEqual({ toUserId: "u2" }));
  });
});
