export const INVITE_TTL_MS = 7 * 24 * 60 * 60 * 1000;
/** Expired or revoked invites are kept this long, then purged (FR-PRIV-06). */
export const INVITE_RETENTION_MS = 30 * 24 * 60 * 60 * 1000;

export type InviteState = "valid" | "expired" | "used" | "revoked";

export interface InviteLifecycle {
  expiresAt: Date;
  acceptedAt: Date | null;
  revokedAt: Date | null;
}

/** Used wins over revoked, revoked over expired, so each state maps to exactly one error code. */
export function inviteState(invite: InviteLifecycle, now: Date): InviteState {
  if (invite.acceptedAt) return "used";
  if (invite.revokedAt) return "revoked";
  if (invite.expiresAt.getTime() <= now.getTime()) return "expired";
  return "valid";
}
