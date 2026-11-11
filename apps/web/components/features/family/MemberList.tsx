"use client";

import { useCallback, useEffect, useState } from "react";
import { t } from "@amar-poribar/shared";
import { api } from "@/lib/api/client";
import type { Family, Member, RoleName } from "@/lib/types";

const ROLE_LABEL: Record<RoleName, "roleOwner" | "roleAdmin" | "roleMember" | "roleViewer"> = {
  owner: "roleOwner",
  admin: "roleAdmin",
  member: "roleMember",
  viewer: "roleViewer",
};

/** Members, roles and invite links (FR-FAM-02, FR-FAM-03). */
export function MemberList(props: { family: Family; meId: string; onError: (e: unknown) => void; onLeft: () => void }) {
  const { family, meId, onError, onLeft } = props;
  const [members, setMembers] = useState<Member[]>([]);
  const [role, setRole] = useState<RoleName>("member");
  const [link, setLink] = useState<string | null>(null);
  const isOwner = family.role === "owner";
  const isAdmin = isOwner || family.role === "admin";
  const base = `/v1/families/${family.id}`;

  const load = useCallback(() => {
    api<Member[]>(`${base}/members`, {}).then(setMembers).catch(onError);
  }, [base, onError]);
  useEffect(load, [load]);

  /** Mirrors the server rules: only the owner manages admins; the owner is never changed. */
  const canManage = (m: Member) => m.role !== "owner" && m.userId !== meId && (m.role !== "admin" || isOwner);
  const assignable: RoleName[] = isOwner ? ["admin", "member", "viewer"] : ["member", "viewer"];

  async function invite() {
    try {
      const res = await api<{ token: string }>(`${base}/invites`, { body: { role } });
      setLink(`${window.location.origin}/?invite=${res.token}`);
    } catch (e) {
      onError(e);
    }
  }
  async function changeRole(m: Member, next: RoleName) {
    try {
      await api(`${base}/members/${m.userId}`, { method: "PATCH", body: { role: next } });
      load();
    } catch (e) {
      onError(e);
    }
  }
  async function remove(m: Member) {
    try {
      await api(`${base}/members/${m.userId}`, { method: "DELETE" });
      if (m.userId === meId) onLeft();
      else load();
    } catch (e) {
      onError(e);
    }
  }

  return (
    <div className="card">
      <strong>
        {t("family")}: {family.name}
      </strong>
      <ul>
        {members.map((m) => (
          <li key={m.userId} className="member">
            <span>
              {m.name ?? m.phone}
              {m.userId === meId && <span className="muted"> · {t("you")}</span>}
              <br />
              <span className="muted">{m.phone}</span>
            </span>
            {isAdmin && canManage(m) ? (
              <select
                value={m.role}
                aria-label={t("members")}
                onChange={(e) => changeRole(m, e.target.value as RoleName)}
              >
                {[...new Set([m.role, ...assignable])].map((r) => (
                  <option key={r} value={r}>
                    {t(ROLE_LABEL[r])}
                  </option>
                ))}
              </select>
            ) : (
              <span className="muted">{t(ROLE_LABEL[m.role])}</span>
            )}
            {isAdmin && canManage(m) ? (
              <button className="icon danger" aria-label={t("remove")} onClick={() => remove(m)}>
                ✗
              </button>
            ) : m.userId === meId && m.role !== "owner" ? (
              <button className="secondary" onClick={() => remove(m)}>
                {t("leave")}
              </button>
            ) : (
              <span />
            )}
          </li>
        ))}
      </ul>
      {isAdmin && (
        <div style={{ marginTop: 12 }}>
          <div className="row">
            <select value={role} aria-label={t("inviteMember")} onChange={(e) => setRole(e.target.value as RoleName)}>
              {assignable.map((r) => (
                <option key={r} value={r}>
                  {t(ROLE_LABEL[r])}
                </option>
              ))}
            </select>
            <button onClick={invite}>{t("inviteMember")}</button>
          </div>
          {link && (
            <>
              <p className="muted" style={{ marginBottom: 0 }}>
                {t("inviteLink")}
              </p>
              <div className="invite-link">{link}</div>
              <button className="secondary" onClick={() => navigator.clipboard?.writeText(link).catch(() => {})}>
                {t("copy")}
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
}
