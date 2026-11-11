import { render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { http, HttpResponse } from "msw";
import { server } from "@/mocks/server";
import { I18nProvider } from "@/lib/i18n/provider";
import { PolicyDialog } from "./PolicyDialog";

describe("PolicyDialog", () => {
  it("loads policy in current locale", async () => {
    const seen: string[] = [];
    server.use(
      http.get("*/api/proxy/v1/policy", ({ request }) => {
        const locale = new URL(request.url).searchParams.get("locale") ?? "";
        seen.push(locale);
        return HttpResponse.json({ version: "v1", text: `policy-${locale}` });
      }),
    );
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(
      <QueryClientProvider client={qc}>
        <I18nProvider initial={{ locale: "en", numerals: "latn", simple: false }}>
          <PolicyDialog open onClose={() => {}} />
        </I18nProvider>
      </QueryClientProvider>,
    );
    expect(await screen.findByText("policy-en")).toBeInTheDocument();
    expect(seen).toEqual(["en"]);
  });
});
