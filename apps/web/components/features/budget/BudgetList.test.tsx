import { render, screen } from "@testing-library/react";
import { t } from "@amar-poribar/shared";
import { http, HttpResponse } from "msw";
import { describe, expect, it } from "vitest";
import { server } from "@/mocks/server";
import { BudgetList } from "./BudgetList";

describe("BudgetList", () => {
  it("exceeded level shows the budgetExceeded word", async () => {
    server.use(
      http.get("http://localhost:4000/v1/families/f1/budgets", () =>
        HttpResponse.json({
          budgets: [
            {
              categoryId: null,
              nameBn: "মোট",
              nameEn: "Overall",
              limitPaisa: 100_000,
              spentPaisa: 120_000,
              level: "exceeded",
              inherited: false,
            },
          ],
        }),
      ),
    );
    render(
      <BudgetList
        token="tok"
        family={{ id: "f1", name: "F", role: "member" }}
        month="2026-03"
        categories={[]}
        spentKey={0}
        onError={() => {}}
      />,
    );
    expect(await screen.findByText(t("budgetExceeded"))).toBeInTheDocument();
  });
});
