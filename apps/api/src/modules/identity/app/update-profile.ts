import type { UpdateProfileInput, UserProfile } from "@amar-poribar/shared";
import { HttpError } from "../../../platform/errors.js";
import type { ProfilePatch, UserBasics, UserRepo } from "./ports.js";

export function toUserProfile(u: UserBasics): UserProfile {
  return {
    id: u.id,
    phone: u.phone,
    name: u.name,
    locale: u.locale === "en" ? "en" : "bn",
    numeralStyle: u.bnDigits ? "bn" : "latin",
    simpleMode: u.simpleMode,
    createdAt: u.createdAt.toISOString(),
  };
}

/** Applies a validated partial profile update for `userId` (`numeralStyle` maps to the `bn_digits` column). */
export async function updateProfile(repo: UserRepo, userId: string, input: UpdateProfileInput): Promise<UserProfile> {
  const patch: ProfilePatch = {};
  if (input.name !== undefined) patch.name = input.name;
  if (input.locale !== undefined) patch.locale = input.locale;
  if (input.numeralStyle !== undefined) patch.bnDigits = input.numeralStyle === "bn";
  if (input.simpleMode !== undefined) patch.simpleMode = input.simpleMode;
  const updated = await repo.updateProfile(userId, patch);
  if (!updated) throw new HttpError(401, "unauthorized", "User not found");
  return toUserProfile(updated);
}
