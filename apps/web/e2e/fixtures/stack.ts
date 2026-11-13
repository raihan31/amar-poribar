export {
  makeUser as createUser,
  makeFamily as createFamily,
  inviteAndJoin as addMember,
  makeTransactions as seedTransactions,
  makeBudgets as seedBudgets,
  fetchClient,
  FIXTURE_PHONES,
} from "@amar-poribar/fixtures";

export const API_URL = process.env.AP_API_URL ?? "http://localhost:4000";
export const WEB_URL = process.env.AP_BASE_URL ?? "http://localhost:3000";

async function poll(url: string, timeoutMs: number): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  let last = "no response";
  while (Date.now() < deadline) {
    try {
      const res = await fetch(url);
      if (res.ok) return;
      last = `status ${res.status}`;
    } catch (e) {
      last = String(e);
    }
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error(`${url} not ready: ${last}`);
}

/** Waits for the real stack (API `/ready` and the web app). */
export async function waitForStack(timeoutMs = 60_000): Promise<void> {
  await poll(`${API_URL}/ready`, timeoutMs);
  await poll(WEB_URL, timeoutMs);
}
