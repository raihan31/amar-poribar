import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render } from "@testing-library/react";
import { http, HttpResponse } from "msw";
import type { ReactElement } from "react";
import { server } from "@/mocks/server";

/** Renders inside a QueryClient and records POST bodies sent to /admin/v1/families/:id/:action. */
export function renderWithQuery(ui: ReactElement) {
  const posts: { action: string; body: Record<string, unknown> }[] = [];
  server.use(
    http.post("*/admin/v1/families/:id/:action", async ({ request, params }) => {
      posts.push({ action: String(params.action), body: (await request.json()) as Record<string, unknown> });
      return HttpResponse.json({ ok: true });
    }),
  );
  render(<QueryClientProvider client={new QueryClient()}>{ui}</QueryClientProvider>);
  return posts;
}
