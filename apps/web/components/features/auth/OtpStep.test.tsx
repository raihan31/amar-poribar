import { fireEvent, render, screen, waitFor, act } from "@testing-library/react";
import { http, HttpResponse } from "msw";
import { server } from "@/mocks/server";
import { OtpStep } from "./OtpStep";

const PHONE = "+8801712345678";

function boxes() {
  return screen.getAllByRole("textbox") as HTMLInputElement[];
}
function paste(code: string) {
  fireEvent.paste(boxes()[0]!, { clipboardData: { getData: () => code } });
}
function invalid(attemptsLeft: number) {
  server.use(
    http.post("*/api/auth/otp/verify", () =>
      HttpResponse.json({ error: { code: "otp_invalid", message: "x", details: { attemptsLeft } } }, { status: 401 }),
    ),
  );
}
function submit() {
  return screen.getByRole("button", { name: "ঢুকুন" });
}

describe("OtpStep", () => {
  it("sixth wrong try shows attemptsLeft 0 and disables submit (AC-12)", async () => {
    invalid(0);
    render(<OtpStep phone={PHONE} onVerified={vi.fn()} onChangePhone={vi.fn()} />);
    paste("111111");
    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent("কোডটি মেলেনি");
    expect(submit()).toHaveAttribute("aria-disabled", "true");
    expect(boxes().every((b) => b.getAttribute("aria-invalid") === "true")).toBe(true);
    expect(screen.getByRole("button", { name: "নতুন কোড পাঠান" })).toBeInTheDocument();
  });

  it("shows attempts left in Bangla digits", async () => {
    invalid(4);
    render(<OtpStep phone={PHONE} onVerified={vi.fn()} onChangePhone={vi.fn()} />);
    paste("111111");
    expect(await screen.findByText(/আর ৪ বার চেষ্টা/)).toBeInTheDocument();
    expect(submit()).not.toHaveAttribute("aria-disabled", "true");
  });

  it("paste fills six boxes and submits", async () => {
    const onVerified = vi.fn();
    render(<OtpStep phone={PHONE} onVerified={onVerified} onChangePhone={vi.fn()} />);
    paste("123456");
    expect(boxes().map((b) => b.value)).toEqual(["1", "2", "3", "4", "5", "6"]);
    await waitFor(() => expect(onVerified).toHaveBeenCalledTimes(1));
  });

  it("expired code shows the expiry message", async () => {
    server.use(
      http.post("*/api/auth/otp/verify", () =>
        HttpResponse.json({ error: { code: "otp_expired", message: "x" } }, { status: 410 }),
      ),
    );
    render(<OtpStep phone={PHONE} onVerified={vi.fn()} onChangePhone={vi.fn()} />);
    paste("222222");
    expect(await screen.findByText("কোডের মেয়াদ শেষ। নতুন কোড নিন।")).toBeInTheDocument();
  });

  it("resend disabled until timer ends", () => {
    vi.useFakeTimers();
    try {
      render(<OtpStep phone={PHONE} onVerified={vi.fn()} onChangePhone={vi.fn()} />);
      const resend = screen.getByRole("button", { name: /কোড আসেনি/ });
      expect(resend).toBeDisabled();
      expect(resend).toHaveTextContent("১:০০");
      act(() => void vi.advanceTimersByTime(59_000));
      expect(resend).toBeDisabled();
      act(() => void vi.advanceTimersByTime(1_000));
      expect(resend).toBeEnabled();
    } finally {
      vi.useRealTimers();
    }
  });

  it("shows the dev code outside production", () => {
    render(<OtpStep phone={PHONE} devCode="123456" onVerified={vi.fn()} onChangePhone={vi.fn()} />);
    expect(screen.getByText("Dev OTP: 123456")).toBeInTheDocument();
  });
});
