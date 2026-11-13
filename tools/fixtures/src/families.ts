import { ok, type ApiClient, type FixtureUser } from "./users.js";

export type Role = "owner" | "admin" | "member" | "viewer";
export type AccountType = "cash" | "bkash" | "nagad" | "rocket" | "upay" | "bank" | "card" | "other";

export interface FixtureCategory {
  id: string;
  key: string;
  kind: "expense" | "income";
  name: string;
}

export interface FixtureAccount {
  id: string;
  name: string;
  type: AccountType;
}

export interface FixtureFamily {
  id: string;
  name: string;
  categories: FixtureCategory[];
  accounts: FixtureAccount[];
}

export async function loadRefs(api: ApiClient, token: string, familyId: string) {
  const categories = ok(
    await api.get<FixtureCategory[]>(`/v1/families/${familyId}/categories`, { token }),
    "categories",
  );
  const accounts = ok(await api.get<FixtureAccount[]>(`/v1/families/${familyId}/accounts`, { token }), "accounts");
  return { categories, accounts };
}

/** The owner creates a family; default categories and the cash account come from the API. */
export async function makeFamily(api: ApiClient, owner: FixtureUser, opts: { name: string }): Promise<FixtureFamily> {
  const token = owner.accessToken;
  const family = ok(
    await api.post<{ id: string; name: string }>("/v1/families", { name: opts.name }, { token }),
    "family",
  );
  return { id: family.id, name: family.name, ...(await loadRefs(api, token, family.id)) };
}

/** The owner invites `user` with `role`, and `user` accepts. */
export async function inviteAndJoin(
  api: ApiClient,
  owner: FixtureUser,
  user: FixtureUser,
  role: Role,
  familyId: string,
): Promise<void> {
  if (role === "owner") throw new Error("a family has exactly one owner");
  const invite = ok(
    await api.post<{ token: string }>(`/v1/families/${familyId}/invites`, { role }, { token: owner.accessToken }),
    "invite",
  );
  ok(await api.post(`/v1/invites/${invite.token}/accept`, {}, { token: user.accessToken }), "accept invite");
}

export async function addAccount(
  api: ApiClient,
  owner: FixtureUser,
  familyId: string,
  input: { name: string; type: AccountType; ownerUserId?: string | null; openingBalancePaisa?: number },
): Promise<FixtureAccount> {
  return ok(
    await api.post<FixtureAccount>(`/v1/families/${familyId}/accounts`, input, { token: owner.accessToken }),
    "account",
  );
}
