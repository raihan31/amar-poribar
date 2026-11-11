import { createElement, type ReactNode } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import { delay, http, HttpResponse } from "msw";
import { describe, expect, it } from "vitest";
import { server } from "@/mocks/server";
import { useFamilies, type FamilyFilterState } from "./useFamilies";

const base: FamilyFilterState = { q: "", plan: "", status: "", quota: "", sort: "", page: 1 };

describe("useFamilies", () => {
  it("keeps previous page while loading", async () => {
    server.use(
      http.get("*/admin/v1/families", async ({ request }) => {
        const q = new URL(request.url).searchParams.get("q");
        if (q) await delay(100);
        return HttpResponse.json({
          items: [
            {
              id: q ?? "a",
              name: q ? "next" : "first",
              ownerPhoneMasked: null,
              members: 1,
              plan: "free",
              aiUsed: 0,
              aiLimit: 100,
              lastActiveAt: null,
              status: "dormant",
            },
          ],
          total: 1,
          nextCursor: null,
        });
      }),
    );
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const wrapper = ({ children }: { children: ReactNode }) =>
      createElement(QueryClientProvider, { client: qc }, children);
    const { result, rerender } = renderHook((p: FamilyFilterState) => useFamilies(p), {
      wrapper,
      initialProps: base,
    });
    await waitFor(() => expect(result.current.data?.items[0]?.name).toBe("first"));
    rerender({ ...base, q: "x" });
    expect(result.current.isPlaceholderData).toBe(true);
    expect(result.current.data?.items[0]?.name).toBe("first");
    await waitFor(() => expect(result.current.data?.items[0]?.name).toBe("next"));
  });
});
