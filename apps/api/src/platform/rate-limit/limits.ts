/** Abuse limits from SRS 11.5. Modules import these numbers, never literals. */
export interface RateRule {
  limit: number;
  windowSeconds: number;
}

export const LIMITS = {
  otpPerHour: { limit: 5, windowSeconds: 3600 },
  nudgePerMinute: { limit: 3, windowSeconds: 60 },
  nudgePerHour: { limit: 20, windowSeconds: 3600 },
  messagesPerMinute: { limit: 60, windowSeconds: 60 },
  uploadsPerDay: { limit: 40, windowSeconds: 86400 },
  callInvitesPerHour: { limit: 10, windowSeconds: 3600 },
  apiPerUserPerMinute: { limit: 300, windowSeconds: 60 },
  apiPerIpPerMinute: { limit: 60, windowSeconds: 60 },
} as const satisfies Record<string, RateRule>;
