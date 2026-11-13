import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { describe, expect, it, vi } from "vitest";
import { server } from "@/mocks/server";
import { translate } from "@/lib/i18n/useT";
import type { BudgetRow, Category } from "@/lib/types";
import { BudgetEditSheet } from "./BudgetEditSheet";

const rows: BudgetRow[] = [
  {
    categoryId: null,
    nameBn: "মোট",
    nameEn: "Overall",
    limitPaisa: 5_000_000,
    spentPaisa: 0,
    level: "ok",
    inherited: false,
  },
  {
    categoryId: "c1",
    nameBn: "বাজার",
    nameEn: "Food",
    limitPaisa: 1_000_000,
    spentPaisa: 0,
    level: "ok",
    inherited: false,
  },
];
const categories = [
  { id: "c1", kind: "expense", nameBn: "বাজার", nameEn: "Food", icon: "🛒" },
] as unknown as Category[];

function setup(role: "owner" | "member") {
  const onSaved = vi.fn();
  const onError = vi.fn();
  render(
    <BudgetEditSheet
      open
      onClose={() => {}}
      familyId="f1"
      month="2026-11"
      role={role}
      rows={rows}
      categories={categories}
      onSaved={onSaved}
      onError={onError}
    />,
  );
  return { onSaved, onError };
}

const label = translate("bn", "bud.amountLabel", { name: "🛒 বাজার" });

describe("BudgetEditSheet", () => {
  it("blank clears and sends limit 0", async () => {
    let body: unknown;
    server.use(
      http.put("*/api/proxy/v1/families/f1/budgets", async ({ request }) => {
        body = await request.json();
        return HttpResponse.json({ budgets: [] });
      }),
    );
    const { onSaved } = setup("owner");
    const input = screen.getByRole("textbox", { name: label });
    expect(input).toHaveValue("10000");
    await userEvent.clear(input);
    await userEvent.click(screen.getByRole("button", { name: translate("bn", "budgetSave") }));
    await waitFor(() => expect(onSaved).toHaveBeenCalled());
    expect(body).toEqual({ budgets: [{ categoryId: "c1", limitPaisa: 0 }] });
  });

  it("unreadable input is ignored", async () => {
    let called = false;
    server.use(
      http.put("*/api/proxy/v1/families/f1/budgets", () => {
        called = true;
        return HttpResponse.json({});
      }),
    );
    const { onSaved } = setup("owner");
    const input = screen.getByRole("textbox", { name: label });
    await userEvent.clear(input);
    await userEvent.type(input, "abc");
    await userEvent.click(screen.getByRole("button", { name: translate("bn", "budgetSave") }));
    await waitFor(() => expect(onSaved).toHaveBeenCalled());
    expect(called).toBe(false);
  });

  it("member cannot open sheet", () => {
    setup("member");
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(screen.queryByRole("textbox")).toBeNull();
  });
});
