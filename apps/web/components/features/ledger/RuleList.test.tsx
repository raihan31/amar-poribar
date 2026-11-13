import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { describe, expect, it, vi } from "vitest";
import { server } from "@/mocks/server";
import { RuleList } from "./RuleList";

const cats = [{ id: "c1", key: "bazar", kind: "expense", nameBn: "বাজার", nameEn: "Groceries", icon: null }];

describe("RuleList", () => {
  it("lists rules and deletes one", async () => {
    const del = vi.fn();
    server.use(
      http.get("*/api/proxy/v1/families/f1/merchant-rules", () =>
        HttpResponse.json([{ id: "r1", pattern: "স্বপ্ন", categoryId: "c1" }]),
      ),
      http.delete("*/api/proxy/v1/families/f1/merchant-rules/r1", () => {
        del();
        return new HttpResponse(null, { status: 204 });
      }),
    );
    render(
      <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
        <RuleList familyId="f1" categories={cats} />
      </QueryClientProvider>,
    );
    expect(await screen.findByText('"স্বপ্ন" → বাজার')).toBeInTheDocument();
    expect(screen.getByText("এই নিয়ম শুধু আপনার পরিবারের জন্য।")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "নিয়ম মুছুন" }));
    await waitFor(() => expect(del).toHaveBeenCalled());
  });
});
