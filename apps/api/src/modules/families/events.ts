import type { Role } from "@amar-poribar/shared";

export interface FamilyCreatedPayload {
  familyId: string;
  ownerUserId: string;
  name: string;
  /** ISO-8601 */
  createdAt: string;
}
export interface MemberJoinedPayload {
  familyId: string;
  userId: string;
  role: Role;
  /** identity.users.id of the person who created the invite. */
  invitedBy: string;
}
export interface MemberRemovedPayload {
  familyId: string;
  userId: string;
}

export interface OwnershipTransferredPayload {
  familyId: string;
  fromUserId: string;
  toUserId: string;
  by: "owner" | "staff";
}

export interface InviteCreatedPayload {
  inviteId: string;
  familyId: string;
  token: string;
  phone: string | null;
  role: Role;
  inviterUserId: string;
  /** ISO-8601 */
  expiresAt: string;
}

export interface FamilySuspendedPayload {
  familyId: string;
  reason: string;
}
export interface FamilyUnsuspendedPayload {
  familyId: string;
}

declare module "../../platform/events/types.js" {
  interface EventMap {
    "families.FamilyCreated.v1": FamilyCreatedPayload;
    "families.MemberJoined.v1": MemberJoinedPayload;
    "families.MemberRemoved.v1": MemberRemovedPayload;
    "families.InviteCreated.v1": InviteCreatedPayload;
    "families.OwnershipTransferred.v1": OwnershipTransferredPayload;
    "families.FamilySuspended.v1": FamilySuspendedPayload;
    "families.FamilyUnsuspended.v1": FamilyUnsuspendedPayload;
  }
}
