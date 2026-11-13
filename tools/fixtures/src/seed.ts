import { addAccount, inviteAndJoin, loadRefs, makeFamily, type FixtureFamily, type Role } from "./families.js";
import { makeBudgets, makeTransactions } from "./ledger.js";
import { FIXTURE_PHONES, makeUser, ok, type ApiClient, type FixtureUser } from "./users.js";

export const DEMO_FAMILY_NAME = "রহিম পরিবার";

/** Who is in the demo family. Names are display labels; the API has no profile-name endpoint yet. */
export const DEMO_MEMBERS: readonly { name: string; phone: string; role: Role }[] = [
  { name: "আব্বু", phone: FIXTURE_PHONES.abbu, role: "owner" },
  { name: "আম্মু", phone: FIXTURE_PHONES.ammu, role: "admin" },
  { name: "দাদি", phone: FIXTURE_PHONES.dadi, role: "member" },
  { name: "তানভীর", phone: FIXTURE_PHONES.tanvir, role: "viewer" },
  { name: "নুসরাত", phone: FIXTURE_PHONES.nusrat, role: "member" },
];

export interface SeedResult {
  created: boolean;
  family: Pick<FixtureFamily, "id" | "name">;
  owner: FixtureUser;
}

/** Month (YYYY-MM) of `d`, as a calendar month in UTC. */
function monthOf(d: Date, back: number): string {
  const x = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() - back, 1));
  return `${x.getUTCFullYear()}-${String(x.getUTCMonth() + 1).padStart(2, "0")}`;
}

/**
 * Creates the demo family through the API. Idempotent: does nothing when the owner phone
 * already belongs to a family with the demo name.
 */
export async function seedDemoFamily(
  api: ApiClient,
  opts: {
    now?: Date;
    /**
     * Called after the family exists and before members are invited. The demo family has five members, above the
     * Free plan limit of three (FR-FAM-10), and no API changes plans yet, so the caller lifts the limit here.
     */
    prepareFamily?: (familyId: string) => Promise<void>;
  } = {},
): Promise<SeedResult> {
  const now = opts.now ?? new Date();
  const owner = await makeUser(api, { phone: FIXTURE_PHONES.abbu });
  const me = ok(
    await api.get<{ families: { id: string; name: string }[] }>("/v1/me", { token: owner.accessToken }),
    "me",
  );
  const existing = me.families.find((f) => f.name === DEMO_FAMILY_NAME);
  if (existing) return { created: false, family: existing, owner };

  const family = await makeFamily(api, owner, { name: DEMO_FAMILY_NAME });
  await opts.prepareFamily?.(family.id);
  for (const m of DEMO_MEMBERS) {
    if (m.role === "owner") continue;
    await inviteAndJoin(api, owner, await makeUser(api, { phone: m.phone }), m.role, family.id);
  }
  // The API creates Cash and bKash; add a bank account and Nagad.
  await addAccount(api, owner, family.id, { name: "ব্র্যাক ব্যাংক", type: "bank", openingBalancePaisa: 50_000_00 });
  await addAccount(api, owner, family.id, { name: "নগদ", type: "nagad" });
  const refs = await loadRefs(api, owner.accessToken, family.id);

  await makeTransactions(api, owner.accessToken, family.id, 120, { seed: 1712, ...refs, days: 90, endsAt: now });
  for (const back of [0, 1, 2]) {
    await makeBudgets(api, owner.accessToken, family.id, { month: monthOf(now, back), categories: refs.categories });
  }
  // Conversation with messages: added with the comms module (T-COMM-*).
  return { created: true, family: { id: family.id, name: family.name }, owner };
}
