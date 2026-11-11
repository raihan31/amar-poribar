import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { vi } from "vitest";
import { server } from "@/mocks/server";
import JoinPage from "./page";

const replace = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace, push: vi.fn() }),
  useParams: () => ({ token: "TOK1" }),
}));

const preview = {
  familyName: "রহিম পরিবার",
  memberCount: 5,
  inviter: { id: "u1", name: "আব্বু" },
  role: "member",
  expiresAt: new Date(Date.now() + 6 * 86_400_000 + 3_600_000).toISOString(),
};

function session(authenticated: boolean) {
  server.use(http.get("*/api/auth/session", () => HttpResponse.json({ authenticated })));
}

describe("join page", () => {
  beforeEach(() => {
    replace.mockClear();
    sessionStorage.clear();
    document.cookie = "ap_fid=; path=/; max-age=0";
  });

  it("unsigned user is sent to login with next", async () => {
    session(false);
    server.use(http.get("*/api/proxy/v1/invites/TOK1", () => HttpResponse.json(preview)));
    render(<JoinPage />);
    await userEvent.click(await screen.findByRole("button", { name: "যোগ দিন" }));
    expect(sessionStorage.getItem("ap_pending_invite")).toBe("TOK1");
    expect(replace).toHaveBeenCalledWith("/login?next=%2Fjoin%2FTOK1");
  });

  it("expired token shows F6 card", async () => {
    session(true);
    server.use(
      http.get("*/api/proxy/v1/invites/TOK1", () =>
        HttpResponse.json({ error: { code: "invite_expired", message: "x" } }, { status: 410 }),
      ),
    );
    render(<JoinPage />);
    expect(await screen.findByText("আমন্ত্রণের মেয়াদ শেষ")).toBeInTheDocument();
    expect(screen.getByText(/নতুন লিংক পাঠাতে বলুন/)).toBeInTheDocument();
  });

  it("accept stores ap_fid and redirects", async () => {
    session(true);
    server.use(
      http.get("*/api/proxy/v1/invites/TOK1", () => HttpResponse.json(preview)),
      http.post("*/api/proxy/v1/invites/TOK1/accept", () => HttpResponse.json({ familyId: "fam-9" })),
    );
    render(<JoinPage />);
    await userEvent.click(await screen.findByRole("button", { name: "যোগ দিন" }));
    await waitFor(() => expect(replace).toHaveBeenCalledWith("/"));
    expect(document.cookie).toContain("ap_fid=fam-9");
    expect(screen.getByRole("status")).toHaveTextContent("পরিবারে যোগ দিয়েছেন");
  });
});
