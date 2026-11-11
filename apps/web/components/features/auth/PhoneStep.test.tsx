import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { server } from "@/mocks/server";
import { PhoneStep } from "./PhoneStep";

describe("PhoneStep", () => {
  it("rejects 12345 with Bangla message", async () => {
    const onSent = vi.fn();
    render(<PhoneStep onSent={onSent} />);
    await userEvent.type(screen.getByRole("textbox"), "12345");
    await userEvent.click(screen.getByRole("button", { name: "কোড পাঠান" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("সঠিক মোবাইল নম্বর দিন");
    expect(onSent).not.toHaveBeenCalled();
  });

  it("normalises +8801712345678", async () => {
    let body: unknown;
    server.use(
      http.post("*/api/auth/otp/request", async ({ request }) => {
        body = await request.json();
        return HttpResponse.json({ sent: true });
      }),
    );
    const onSent = vi.fn();
    render(<PhoneStep onSent={onSent} />);
    await userEvent.type(screen.getByRole("textbox"), "+8801712345678");
    expect(screen.getByRole("textbox")).toHaveValue("০১৭১২ ৩৪৫ ৬৭৮");
    await userEvent.click(screen.getByRole("button", { name: "কোড পাঠান" }));
    await waitFor(() => expect(onSent).toHaveBeenCalledWith("+8801712345678", undefined));
    expect(body).toEqual({ phone: "+8801712345678" });
  });

  it("shows the rate limit banner", async () => {
    server.use(
      http.post("*/api/auth/otp/request", () =>
        HttpResponse.json(
          { error: { code: "otp_rate_limited", message: "x", details: { retryAfterSeconds: 90 } } },
          { status: 429 },
        ),
      ),
    );
    render(<PhoneStep onSent={vi.fn()} />);
    await userEvent.type(screen.getByRole("textbox"), "01712345678");
    await userEvent.click(screen.getByRole("button", { name: "কোড পাঠান" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("এক ঘণ্টায় সর্বোচ্চ ৫ বার কোড চাওয়া যায়।");
  });
});
