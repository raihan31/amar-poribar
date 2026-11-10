import { HttpError } from "../../../platform/errors.js";
import type { UserBasics, UserRepo } from "./ports.js";

export type UserId = string;

/** What other modules may know about a user. Never contains the phone number. */
export interface UserSummary {
  id: UserId;
  name: string | null;
  locale: string;
  numeralStyle: "bn" | "latin";
  simpleMode: boolean;
}

export type UserWithPhone = UserSummary & { phone: string };

function summary(u: UserBasics): UserSummary {
  return {
    id: u.id,
    name: u.name,
    locale: u.locale,
    numeralStyle: u.bnDigits ? "bn" : "latin",
    simpleMode: u.simpleMode,
  };
}

export async function getUser(repo: UserRepo, id: UserId): Promise<UserSummary | null> {
  const u = await repo.getBasics(id);
  return u ? summary(u) : null;
}

export async function getUsers(repo: UserRepo, ids: readonly UserId[]): Promise<Map<string, UserSummary>> {
  const rows = await repo.getManyBasics(ids);
  return new Map(rows.map((u) => [u.id, summary(u)]));
}

export async function getUserWithPhone(repo: UserRepo, id: UserId): Promise<UserWithPhone | null> {
  const u = await repo.getBasics(id);
  return u ? { ...summary(u), phone: u.phone } : null;
}

export async function findUserByPhone(repo: UserRepo, phone: string): Promise<UserWithPhone | null> {
  const found = await repo.findByPhone(phone);
  return found ? getUserWithPhone(repo, found.id) : null;
}

/** 401 `unauthorized` when the user is missing or erased. */
export async function requireUser(repo: UserRepo, id: UserId): Promise<UserSummary> {
  const u = await repo.getBasics(id);
  if (!u || u.erasedAt) throw new HttpError(401, "unauthorized", "User not found");
  return summary(u);
}
