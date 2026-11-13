import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { describe, expect, it, vi } from "vitest";
import { server } from "@/mocks/server";
import FamilyPage from "./page";

vi.mock("next/navigation", () => ({ useParams: () => ({ id: "fam_8f2c9d0e7b6a41a" }) }));

const view = () =>
  render(
    <QueryClientProvider client={new QueryClient()}>
      <FamilyPage />
    </QueryClientProvider>,
  );

describe("family detail page", () => {
  it("renders header and shows toast after an action", async () => {
    const bodies: unknown[] = [];
    server.use(
      http.post("*/admin/v1/families/:id/quota", async ({ request }) => {
        bodies.push(await request.json());
        return HttpResponse.json({ ok: true });
      }),
    );
    view();
    expect(await screen.findByRole("heading", { name: "রহিম পরিবার" })).toBeInTheDocument();
    expect(screen.getByText(/ID fam_8f2c…41a/)).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Add 50 entries" }));
    const dlg = within(screen.getByRole("dialog", { name: "Add AI entries" }));
    await userEvent.type(dlg.getByLabelText(/Reason/), "pilot extension");
    await userEvent.click(dlg.getByRole("button", { name: "Add entries" }));
    expect(await screen.findByText("Done. Recorded in the audit log.")).toBeInTheDocument();
    await waitFor(() => expect(bodies).toEqual([{ add: 50, reason: "pilot extension" }]));
  });

  it("delete shows the scheduled banner", async () => {
    view();
    await userEvent.click(await screen.findByRole("button", { name: "Delete family and data…" }));
    const dlg = within(screen.getByRole("dialog", { name: "Delete family and data" }));
    await userEvent.type(dlg.getByLabelText(/Reason/), "owner requested deletion");
    await userEvent.type(dlg.getByLabelText("Type the family name to confirm"), "রহিম পরিবার");
    await userEvent.click(dlg.getByLabelText(/30-day deletion/));
    await userEvent.click(dlg.getByRole("button", { name: "Delete family" }));
    expect(await screen.findByText(/Deletion scheduled for 13 Dec 2026/)).toBeInTheDocument();
  });
});
