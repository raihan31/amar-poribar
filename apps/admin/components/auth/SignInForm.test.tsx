import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { afterEach, describe, expect, it, vi } from "vitest";
import { server } from "@/mocks/server";
import { SignInForm } from "./SignInForm";

const replace = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace }),
  useSearchParams: () => new URLSearchParams("next=%2Ffamilies"),
}));
vi.mock("@/lib/auth/qr", () => ({ drawQr: vi.fn(async () => {}) }));

afterEach(() => replace.mockReset());

async function fillCredentials() {
  await userEvent.type(screen.getByLabelText("Work email"), "rubel@amarporibar.example");
  await userEvent.type(screen.getByLabelText("Password"), "hunter2hunter2");
  await userEvent.click(screen.getByRole("button", { name: "Sign in" }));
}

const totpRequired = http.post("*/api/staff/login", () =>
  HttpResponse.json({ status: "totp_required", challengeId: "c1" }),
);

describe("SignInForm", () => {
  it("code row enabled after credentials accepted", async () => {
    server.use(totpRequired);
    render(<SignInForm />);
    const boxes = () => screen.getAllByLabelText(/^Digit \d$/);
    expect(boxes()).toHaveLength(6);
    boxes().forEach((b) => expect(b).toBeDisabled());
    await fillCredentials();
    await waitFor(() => boxes().forEach((b) => expect(b).toBeEnabled()));
  });

  it("generic message for bad credentials", async () => {
    server.use(
      http.post("*/api/staff/login", () =>
        HttpResponse.json({ error: { code: "invalid_credentials", message: "x" } }, { status: 401 }),
      ),
    );
    render(<SignInForm />);
    await fillCredentials();
    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent("Email or password is not correct.");
  });

  it("submits code and replaces route with next", async () => {
    server.use(
      totpRequired,
      http.post("*/api/staff/totp", () => HttpResponse.json({ ok: true, role: "owner", name: "Rubel" })),
    );
    render(<SignInForm />);
    await fillCredentials();
    await waitFor(() => expect(screen.getByLabelText("Digit 1")).toBeEnabled());
    await userEvent.click(screen.getByLabelText("Digit 1"));
    await userEvent.paste("123456");
    await userEvent.click(screen.getByRole("button", { name: "Sign in" }));
    await waitFor(() => expect(replace).toHaveBeenCalledWith("/families"));
  });

  it("wrong code shows attempts left", async () => {
    server.use(
      totpRequired,
      http.post("*/api/staff/totp", () =>
        HttpResponse.json({ error: { code: "totp_invalid", attemptsLeft: 4 } }, { status: 401 }),
      ),
    );
    render(<SignInForm />);
    await fillCredentials();
    await waitFor(() => expect(screen.getByLabelText("Digit 1")).toBeEnabled());
    await userEvent.click(screen.getByLabelText("Digit 1"));
    await userEvent.paste("000000");
    await userEvent.click(screen.getByRole("button", { name: "Sign in" }));
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "That code is not correct. Try the next code. 4 attempts left.",
    );
  });

  it("locked account disables the form then re-enables after countdown", async () => {
    server.use(
      http.post("*/api/staff/login", () =>
        HttpResponse.json({ error: { code: "account_locked", retryAfterSeconds: 1 } }, { status: 423 }),
      ),
    );
    render(<SignInForm />);
    await fillCredentials();
    expect(await screen.findByText(/Try again in 0:01/)).toBeInTheDocument();
    expect(screen.getByLabelText("Work email")).toBeDisabled();
    expect(screen.getByRole("button", { name: "Sign in" })).toBeDisabled();
    await act(async () => {
      await new Promise((r) => setTimeout(r, 1300));
    });
    expect(screen.getByLabelText("Work email")).toBeEnabled();
    expect(screen.queryByText(/Try again in/)).toBeNull();
  });

  it("lost device shows info dialog", async () => {
    render(<SignInForm />);
    await userEvent.click(screen.getByRole("button", { name: "Lost your device?" }));
    expect(screen.getByText(/Ask a Staff Owner to reset it/)).toBeInTheDocument();
  });
});
