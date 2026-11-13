import { test, expect, checkA11y } from "../fixtures/test";
import { demo, problem, stub } from "../helpers/mockApi";

const mine = demo.transactions[0]!;
const OTHER_FAMILY = "00000000-0000-4000-8000-0000000000ff";

test("member cannot edit another member's transaction @mock", async ({ page, mockUser: _ }) => {
  void _;
  // Someone else's entry: the server says 403 on delete (the list says canEdit true to a stale screen).
  await stub(page, "DELETE", "/v1/families/*/transactions/*", problem(403, "forbidden"));
  await page.goto(`/txn/${mine.id}`);
  await page.getByRole("button", { name: "মুছুন", exact: true }).click();
  await page.getByRole("button", { name: "হ্যাঁ, মুছুন" }).click();

  await expect(page.getByText("আপনি শুধু নিজের খরচ বদলাতে পারেন।")).toBeVisible();
  await expect(page.getByRole("button", { name: "মুছুন", exact: true })).toBeDisabled();
  await expect(page.getByRole("button", { name: "বদলান" })).toBeDisabled();
  await checkA11y(page);
});

test("member sees edit and delete locked when the entry is not theirs @mock", async ({ page, mockUser: _ }) => {
  void _;
  await stub(page, "GET", "/v1/families/*/transactions/*", async (route) => {
    const res = await route.fetch();
    const body = (await res.json()) as Record<string, unknown>;
    await route.fulfill({ response: res, json: { ...body, canEdit: false, canDelete: false, isMine: false } });
  });
  await page.goto(`/txn/${mine.id}`);
  await expect(page.getByText("আপনি শুধু নিজের খরচ বদলাতে পারেন।")).toBeVisible();
  await expect(page.getByRole("button", { name: "মুছুন", exact: true })).toBeDisabled();
  await checkA11y(page);
});

test("foreign family id returns not found page @mock", async ({ page, mockUser: _ }) => {
  void _;
  // Any family-scoped call for a family the user is not in answers 404 (never 403).
  await stub(page, "GET", `/v1/families/${OTHER_FAMILY}/*`, problem(404, "not_found"));
  await page.goto("/");
  const status = await page.evaluate(
    async (id) => (await fetch(`/api/proxy/v1/families/${id}/transactions`, { headers: { "x-ap-csrf": "1" } })).status,
    OTHER_FAMILY,
  );
  expect(status).toBe(404);

  // The app has no route for another family's id, so the not-found page shows.
  await page.goto(`/family/${OTHER_FAMILY}`);
  await expect(page.getByText("পাতাটি পাওয়া যায়নি।")).toBeVisible();
  await expect(page.getByRole("link", { name: "হোমে যান" })).toBeVisible();
  await checkA11y(page);
});
