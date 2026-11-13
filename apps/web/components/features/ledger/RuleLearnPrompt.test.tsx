import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { describe, expect, it, vi } from "vitest";
import { server } from "@/mocks/server";
import { RuleLearnPrompt, shouldOfferRule } from "./RuleLearnPrompt";

const URL_RULES = "*/api/proxy/v1/families/f1/merchant-rules";

function renderIt() {
  const onClose = vi.fn();
  render(
    <RuleLearnPrompt
      open
      familyId="f1"
      pattern="শপনো"
      fromName="অন্যান্য"
      to={{ id: "c1", name: "বাজার" }}
      onClose={onClose}
    />,
  );
  return onClose;
}

describe("RuleLearnPrompt", () => {
  it("yes posts a rule", async () => {
    const posted = vi.fn();
    server.use(
      http.post(URL_RULES, async ({ request }) => {
        posted(await request.json());
        return HttpResponse.json({ id: "r1" }, { status: 201 });
      }),
    );
    const onClose = renderIt();
    expect(screen.getByText('এরপর থেকে "শপনো" সবসময় বাজারে রাখব?')).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "হ্যাঁ" }));
    await waitFor(() => expect(posted).toHaveBeenCalledWith({ pattern: "শপনো", categoryId: "c1" }));
    await waitFor(() => expect(onClose).toHaveBeenCalled());
  });

  it("no does nothing", async () => {
    const posted = vi.fn();
    server.use(
      http.post(URL_RULES, () => {
        posted();
        return HttpResponse.json({}, { status: 201 });
      }),
    );
    const onClose = renderIt();
    await userEvent.click(screen.getByRole("button", { name: "না" }));
    expect(onClose).toHaveBeenCalled();
    expect(posted).not.toHaveBeenCalled();
  });

  it("offers a rule only when leaving other for a merchant-like note", () => {
    const to = { id: "c1", key: "bazar" };
    expect(shouldOfferRule({ key: "other" }, to, "শপনো")).toBe(true);
    expect(shouldOfferRule(null, to, "শপনো")).toBe(true);
    expect(shouldOfferRule({ key: "transport" }, to, "শপনো")).toBe(false);
    expect(shouldOfferRule({ key: "other" }, to, "")).toBe(false);
  });
});
