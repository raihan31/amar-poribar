import { test } from "@playwright/test";
import { addMember, createFamily, createUser, fetchClient, API_URL } from "../fixtures/stack";

export const FAKES_URL = process.env.AP_FAKES_URL ?? "http://localhost:4100";

/** A phone nobody used before, so a re-run against the same stack never meets old data. */
export function freshPhone(): string {
  const tail = String(Math.floor(Math.random() * 1e8)).padStart(8, "0");
  return `017${tail}`;
}

/**
 * Stack specs create real users and spend the API's per-IP OTP budget (30 an hour), so they run once, in the
 * desktop project, instead of once per viewport.
 */
export function stackOnce(testInfo: { project: { name: string } }): void {
  test.skip(testInfo.project.name !== "desktop-web", "stack specs run in one project to spare the OTP budget");
  test.setTimeout(90_000);
}

/** Number of calls the fake Claude service has served (`GET /__fake/claude/calls`). */
export async function fakeClaudeCalls(): Promise<number> {
  const res = await fetch(`${FAKES_URL}/__fake/claude/calls`);
  if (!res.ok) throw new Error(`fake claude counter: ${res.status}`);
  return ((await res.json()) as { count: number }).count;
}

export interface StackUser {
  phone: string;
  accessToken: string;
  refreshToken: string;
}

export interface StackFamily {
  owner: StackUser;
  member: StackUser;
  familyId: string;
}

/** Two signed-up users in one new family, built through the API only (tools/fixtures). */
export async function stackFamily(name = "রহিম পরিবার"): Promise<StackFamily> {
  const api = fetchClient(API_URL, FAKES_URL);
  const owner = await createUser(api, { phone: freshPhone() });
  const member = await createUser(api, { phone: freshPhone() });
  const family = await createFamily(api, owner, { name });
  await addMember(api, owner, member, "member", family.id);
  return { owner, member, familyId: family.id };
}
