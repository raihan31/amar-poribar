import { z } from "zod";
import { HttpError, parseOr400 } from "../../../platform/errors.js";
import { POLICY_VERSION } from "../content/policy.version.js";
import type { ConsentRepo } from "../infra/consent-repo.js";

export const AcceptConsentSchema = z.object({
  kind: z.enum(["privacy_policy", "voice_notes"]),
  version: z.string().min(1).max(40),
  locale: z.enum(["bn", "en"]),
});

export interface ConsentState {
  privacyPolicy: { acceptedVersion: string | null; current: string; needsAcceptance: boolean };
  voiceNotes: { accepted: boolean };
}

export async function acceptConsent(
  repo: ConsentRepo,
  clock: () => Date,
  userId: string,
  body: unknown,
): Promise<{ kind: string; version: string; locale: string }> {
  const input = parseOr400(AcceptConsentSchema, body);
  if (input.version !== POLICY_VERSION) {
    throw new HttpError(409, "policy_version_outdated", "Policy version is outdated", {
      currentVersion: POLICY_VERSION,
    });
  }
  await repo.record(userId, input.kind, input.version, input.locale, clock());
  return input;
}

export async function getConsentState(repo: ConsentRepo, userId: string): Promise<ConsentState> {
  const [acceptedVersion, voice] = await Promise.all([
    repo.latestVersion(userId, "privacy_policy"),
    repo.hasAccepted(userId, "voice_notes", POLICY_VERSION),
  ]);
  return {
    privacyPolicy: {
      acceptedVersion,
      current: POLICY_VERSION,
      needsAcceptance: acceptedVersion !== POLICY_VERSION,
    },
    voiceNotes: { accepted: voice },
  };
}
