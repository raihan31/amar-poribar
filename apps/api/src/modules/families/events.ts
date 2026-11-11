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
}
export interface MemberRemovedPayload {
  familyId: string;
  userId: string;
}

declare module "../../platform/events/types.js" {
  interface EventMap {
    "families.FamilyCreated.v1": FamilyCreatedPayload;
    "families.MemberJoined.v1": MemberJoinedPayload;
    "families.MemberRemoved.v1": MemberRemovedPayload;
  }
}
