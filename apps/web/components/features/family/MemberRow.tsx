"use client";

import { useRouter } from "next/navigation";
import { useT } from "@/lib/i18n/useT";
import type { RoleName } from "@/lib/types";
import { Avatar } from "../../ui/Avatar";
import { Button } from "../../ui/Button";
import { Icon, type IconName } from "../../ui/icons";
import { ROLE_KEY, RoleSelect } from "./RoleSelect";

/** A row of `GET /v1/families/:id/members`; `phone` is null for non-admin callers. */
export interface FamilyMember {
  userId: string;
  role: RoleName;
  name?: string | null;
  displayName?: string;
  phone?: string | null;
}

export function memberName(m: FamilyMember): string {
  return m.displayName || m.name || m.phone || "";
}

/** Mirrors `families/domain/roles.ts#canManageMember`: nobody changes the owner, only the owner changes admins. */
export function canManage(actor: RoleName, m: FamilyMember, meId: string | undefined): boolean {
  if (m.userId === meId || m.role === "owner") return false;
  if (m.role === "admin") return actor === "owner";
  return actor === "owner" || actor === "admin";
}

/** Mirrors `canAssignRole`: only owners create admins; nobody assigns owner. */
export function assignableRoles(actor: RoleName): RoleName[] {
  if (actor === "owner") return ["admin", "member", "viewer"];
  if (actor === "admin") return ["member", "viewer"];
  return [];
}

export interface MemberRowProps {
  member: FamilyMember;
  meId: string | undefined;
  actorRole: RoleName;
  onRoleChange: (m: FamilyMember, role: RoleName) => void;
  onRemove: (m: FamilyMember) => void;
}

export function MemberRow({ member, meId, actorRole, onRoleChange, onRemove }: MemberRowProps) {
  const t = useT();
  const router = useRouter();
  const name = memberName(member);
  const self = member.userId === meId;
  const manage = canManage(actorRole, member, meId);

  const act = (icon: IconName, label: string, cls: string, path: string) => (
    <button
      type="button"
      className={`member-act member-act--${cls}`}
      aria-label={label}
      onClick={() => router.push(`${path}?to=${encodeURIComponent(member.userId)}`)}
    >
      <Icon name={icon} size={24} />
    </button>
  );

  return (
    <li className="member-row">
      <Avatar name={name} size={48} />
      <div className="member-main">
        <strong>
          {name}
          {self && ` (${t("you")})`}
        </strong>
        {manage ? (
          <RoleSelect
            value={member.role}
            options={assignableRoles(actorRole)}
            label={t("fam.roleOf", { name })}
            onChange={(r) => onRoleChange(member, r)}
          />
        ) : (
          <span className="role-pill">{t(ROLE_KEY[member.role])}</span>
        )}
      </div>
      {!self && act("buzz", t("fam.buzz"), "buzz", "/buzz")}
      {!self && member.role !== "viewer" && act("chat", t("fam.chat"), "chat", "/chat")}
      {!self && member.role === "viewer" && act("video", t("fam.video"), "chat", "/call/new")}
      {manage && (
        <button
          type="button"
          className="member-act member-act--danger"
          aria-label={t("fam.removeMember", { name })}
          onClick={() => onRemove(member)}
        >
          <Icon name="close" size={24} />
        </button>
      )}
      {self && member.role !== "owner" && (
        <Button variant="secondary" onClick={() => onRemove(member)}>
          {t("leave")}
        </Button>
      )}
    </li>
  );
}
