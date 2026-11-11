/** Outbound capabilities `families` needs but does not own. Wired at module registration (SRS 3.1). */
export interface InviteNotifyArgs {
  userId: string;
  kind: "invite";
  title: string;
  body: string;
  data: { token: string };
  /** Template parameters for implementations that render their own copy. */
  params: { inviter: string; family: string };
}

export interface InvitePorts {
  /** Inbox item (and push) for an existing user; implemented by notifications. */
  notify(args: InviteNotifyArgs): Promise<void>;
  /** Plain SMS to a phone number; backed by the platform SMS gateway. */
  smsSend(phone: string, text: string): Promise<void>;
}
