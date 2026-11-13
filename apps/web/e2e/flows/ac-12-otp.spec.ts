import type { Page } from "@playwright/test";
import { test, expect, checkA11y, waitForStack } from "../fixtures/test";
import { problem, stub } from "../helpers/mockApi";
import { freshPhone, stackOnce } from "../helpers/stackData";

const RATE_LIMIT = "এক ঘণ্টায় সর্বোচ্চ ৫ বার কোড চাওয়া যায়।";

/** The sixth wrong try, sent straight to the BFF (the form is already locked after the fifth). */
async function sixthTry(page: Page, phone: string): Promise<void> {
  const res = await page.evaluate(async (p) => {
    const r = await fetch("/api/auth/otp/verify", {
      method: "POST",
      headers: { "content-type": "application/json", "x-ap-csrf": "1" },
      body: JSON.stringify({ phone: p, code: "999999" }),
    });
    return {
      status: r.status,
      body: (await r.json()) as { error?: { code?: string; details?: { attemptsLeft?: number } } },
    };
  }, phone);
  expect(res.status).toBe(401);
  expect(res.body.error?.code).toBe("otp_invalid");
  expect(res.body.error?.details?.attemptsLeft).toBe(0);
}

async function askForCode(page: Page, phone: string): Promise<void> {
  await page.goto("/login");
  await page.getByLabel("আপনার মোবাইল নম্বর দিন").fill(phone);
  await page.getByRole("button", { name: "কোড পাঠান" }).click();
}

test("sixth wrong code shows A7 @mock", async ({ page, context, baseURL }) => {
  await context.addCookies([{ name: "ap_loc", value: "bn", url: baseURL! }]);
  let tries = 0;
  await stub(page, "POST", "/api/auth/otp/request", { body: { sent: true } });
  // Server rule: attemptsLeft counts down 4, 3, 2, 1, 0 and stays 0 on every later try.
  await stub(page, "POST", "/api/auth/otp/verify", (route) => {
    tries += 1;
    const attemptsLeft = Math.max(0, 5 - tries);
    return route.fulfill({
      status: 401,
      contentType: "application/json",
      body: JSON.stringify(problem(401, "otp_invalid", { attemptsLeft }).body),
    });
  });

  await askForCode(page, "01712345678");
  const boxes = page.getByRole("textbox", { name: /^কোডের/ });
  await boxes.first().click();
  await page.keyboard.type("111111");
  await expect(page.getByText("কোডটি মেলেনি")).toBeVisible();
  await expect(page.getByText("আর ৪ বার চেষ্টা করতে পারবেন।")).toBeVisible();

  // Wrong tries two to five: change the last digit, which sends the code again.
  for (let n = 2; n <= 5; n++) {
    await expect(boxes.last()).toBeEnabled();
    await boxes.last().fill(String(n));
    await expect.poll(() => tries).toBe(n);
  }

  // No tries are left: A7 asks for a new code and the boxes are locked; the sixth try is refused as well.
  await expect(page.getByText("আর চেষ্টা করা যাবে না। নতুন কোড নিন।")).toBeVisible();
  await expect(page.getByRole("button", { name: "নতুন কোড পাঠান" })).toBeVisible();
  await expect(boxes.first()).toBeDisabled();
  await sixthTry(page, "+8801712345678");
  await checkA11y(page);
});

test("sixth code request shows rate limit @mock", async ({ page, context, baseURL }) => {
  await context.addCookies([{ name: "ap_loc", value: "bn", url: baseURL! }]);
  let asked = 0;
  await stub(page, "POST", "/api/auth/otp/request", (route) => {
    asked += 1;
    return asked <= 5
      ? route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ sent: true }) })
      : route.fulfill({
          status: 429,
          contentType: "application/json",
          body: JSON.stringify(problem(429, "otp_rate_limited", { retryAfterSeconds: 1800 }).body),
        });
  });
  await page.goto("/login");
  // Five requests in the hour are fine; the sixth one comes from the form.
  for (let i = 0; i < 5; i++) {
    const status = await page.evaluate(
      async () =>
        (
          await fetch("/api/auth/otp/request", {
            method: "POST",
            headers: { "content-type": "application/json", "x-ap-csrf": "1" },
            body: JSON.stringify({ phone: "+8801712345678" }),
          })
        ).status,
    );
    expect(status).toBe(200);
  }
  await askForCode(page, "01712345678");
  await expect(page.getByText(RATE_LIMIT, { exact: false })).toBeVisible();
  await checkA11y(page);
});

test("sixth wrong code shows A7 @stack", async ({ page, baseURL }, testInfo) => {
  stackOnce(testInfo);
  await waitForStack();
  const phone = freshPhone();
  await page.context().addCookies([{ name: "ap_loc", value: "bn", url: baseURL! }]);
  await askForCode(page, phone);
  const boxes = page.getByRole("textbox", { name: /^কোডের/ });
  await boxes.first().click();
  // A code that is certainly not the one that was sent: 000000 unless that is the real one.
  await page.keyboard.type("000000");
  for (let n = 1; n <= 5; n++) {
    await expect(page.getByText("কোডটি মেলেনি")).toBeVisible();
    if (n < 5) await boxes.last().fill(String(n));
  }
  // Five wrong codes lock the form (attemptsLeft 0); the sixth is refused by the API with the same answer.
  await expect(page.getByText("আর চেষ্টা করা যাবে না। নতুন কোড নিন।")).toBeVisible();
  await expect(boxes.first()).toBeDisabled();
  await sixthTry(page, `+88${phone}`);
  await checkA11y(page);
});

test("sixth code request shows rate limit @stack", async ({ page, baseURL }, testInfo) => {
  stackOnce(testInfo);
  await waitForStack();
  const phone = freshPhone();
  await page.context().addCookies([{ name: "ap_loc", value: "bn", url: baseURL! }]);
  const headers = { origin: baseURL!, "content-type": "application/json", "x-ap-csrf": "1" };
  // The API also keeps a 60 second gap between codes for one phone, so a second request right away is refused
  // with the same `otp_rate_limited` answer as the sixth one in an hour (that count is an API test).
  const first = await page.request.post("/api/auth/otp/request", { headers, data: { phone: `+88${phone}` } });
  expect(first.ok(), "first request").toBe(true);
  await askForCode(page, phone);
  await expect(page.getByText(RATE_LIMIT, { exact: false })).toBeVisible();
  await checkA11y(page);
});
