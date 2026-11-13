import type { Db } from "../../../platform/db.js";
import type { DomainEvent } from "../../../platform/events/types.js";
import type { IdentityFacade } from "../../identity/index.js";
import type { InviteCreatedPayload } from "../events.js";
import { familiesRepo } from "../infra/families.repo.js";
import type { InvitePorts } from "./ports.js";

export interface InviteDeliveryDeps {
  db: Db;
  identity: Pick<IdentityFacade, "findUserByPhone" | "getUserBasics">;
  /** Resolved per call because notifications registers after families. */
  ports: () => InvitePorts | undefined;
  publicWebUrl: string;
}

const clip = (s: string, n: number) => (s.length <= n ? s : `${s.slice(0, n - 1)}…`);

/** SMS copy: at most 70 characters before the link (two segments allowed). */
export function inviteSmsText(inviter: string, family: string, link: string): string {
  return `${clip(inviter, 14)} আপনাকে ${clip(family, 20)} পরিবারে ডাকছেন ${link}`;
}

/**
 * Delivers a phone invite: inbox item for a registered user, else an SMS with the join link (FR-FAM-06).
 * Idempotent by invite id: the delivery is claimed with a conditional update and released if sending fails.
 */
export async function onInviteCreated(deps: InviteDeliveryDeps, event: DomainEvent<string, InviteCreatedPayload>) {
  const p = event.payload;
  if (!p.phone) return;
  const ports = deps.ports();
  if (!ports) throw new Error("families: invite delivery ports are not wired");
  if (!(await familiesRepo.claimInviteDelivery(deps.db, p.inviteId, new Date()))) return;
  try {
    const [inviter, family] = await Promise.all([
      deps.identity.getUserBasics(p.inviterUserId),
      familiesRepo.familyById(deps.db, p.familyId),
    ]);
    const inviterName = inviter?.name ?? "";
    const familyName = family?.name ?? "";
    const user = await deps.identity.findUserByPhone(p.phone);
    if (user) {
      await ports.notify({
        userId: user.id,
        kind: "invite",
        title: "পরিবারে আমন্ত্রণ",
        body: `${inviterName} আপনাকে ${familyName} পরিবারে ডাকছেন`,
        data: { token: p.token },
        params: { inviter: inviterName, family: familyName },
      });
    } else {
      await ports.smsSend(p.phone, inviteSmsText(inviterName, familyName, `${deps.publicWebUrl}/join/${p.token}`));
    }
  } catch (e) {
    await familiesRepo.releaseInviteDelivery(deps.db, p.inviteId);
    throw e;
  }
}
