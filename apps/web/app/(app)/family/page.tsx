"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api/client";
import { ApiProblem } from "@/lib/api/errors";
import { qk } from "@/lib/api/queryKeys";
import { useFormat } from "@/lib/i18n/format";
import { useT } from "@/lib/i18n/useT";
import type { RoleName } from "@/lib/types";
import { InviteSheet } from "@/components/features/family/InviteSheet";
import { MemberRow, assignableRoles, memberName, type FamilyMember } from "@/components/features/family/MemberRow";
import { TransferOwnershipDialog } from "@/components/features/family/TransferOwnershipDialog";
import { PageHeader } from "@/components/shell/PageHeader";
import { useFamily } from "@/components/shell/useFamily";
import { Banner } from "@/components/ui/Banner";
import { Button } from "@/components/ui/Button";
import { Dialog } from "@/components/ui/Dialog";

interface PendingInvite {
  id: string;
  role: RoleName;
  expiresAt: string;
  forPhoneMasked?: string;
}

const DAY_MS = 86_400_000;

/** B4: members, roles and invites (FR-FAM-02, -03, -04, -07, -10). */
export default function FamilyPage() {
  const t = useT();
  const { num } = useFormat();
  const router = useRouter();
  const qc = useQueryClient();
  const { family, role, me } = useFamily();
  const meId = me?.id;
  const base = `/v1/families/${family.id}`;
  const isAdmin = role === "owner" || role === "admin";

  const [inviteOpen, setInviteOpen] = useState(false);
  const [transferOpen, setTransferOpen] = useState(false);
  const [limitOpen, setLimitOpen] = useState(false);
  const [confirm, setConfirm] = useState<FamilyMember | null>(null);
  const [link, setLink] = useState<{ url: string; copied: boolean } | null>(null);
  const [failed, setFailed] = useState(false);
  const [now] = useState(() => Date.now());

  const members = useQuery({
    queryKey: qk.family(family.id).members(),
    queryFn: () => api<FamilyMember[]>(`${base}/members`),
  });
  const invites = useQuery({
    queryKey: [...qk.family(family.id).all, "invites"],
    queryFn: () => api<PendingInvite[]>(`${base}/invites`),
    enabled: isAdmin,
  });

  const list = members.data ?? [];
  const pending = (invites.data ?? []).filter((i) => i.forPhoneMasked);
  const refresh = () => qc.invalidateQueries({ queryKey: qk.family(family.id).all });

  /** Plan limit opens the plans dialog; anything else is a plain failure banner. */
  function fail(e: unknown) {
    if (e instanceof ApiProblem && e.code === "plan_member_limit") setLimitOpen(true);
    else setFailed(true);
  }

  async function changeRole(m: FamilyMember, next: RoleName) {
    setFailed(false);
    try {
      await api(`${base}/members/${m.userId}`, { method: "PATCH", body: { role: next } });
      await refresh();
    } catch (e) {
      fail(e);
    }
  }

  async function removeConfirmed() {
    const m = confirm;
    setConfirm(null);
    if (!m) return;
    setFailed(false);
    try {
      await api(`${base}/members/${m.userId}`, { method: "DELETE" });
      if (m.userId === meId) {
        qc.removeQueries({ queryKey: qk.family(family.id).all });
        await qc.invalidateQueries({ queryKey: qk.me() });
        router.replace("/");
      } else {
        await refresh();
      }
    } catch (e) {
      fail(e);
    }
  }

  async function invitePhone(input: { phone: string; role: RoleName }) {
    setFailed(false);
    try {
      await api(`${base}/invites`, { body: input });
      setInviteOpen(false);
      await refresh();
    } catch (e) {
      setInviteOpen(false);
      fail(e);
      throw e;
    }
  }

  async function sendLink() {
    setFailed(false);
    try {
      const res = await api<{ link?: string; token: string }>(`${base}/invites`, { body: { role: "member" } });
      const url = res.link ?? `${window.location.origin}/join/${res.token}`;
      let copied = false;
      if (typeof navigator.share === "function") {
        await navigator.share({ url, title: family.name }).catch(() => {});
      } else {
        copied = await (navigator.clipboard?.writeText(url).then(() => true) ?? Promise.resolve(false)).catch(
          () => false,
        );
      }
      setLink({ url, copied });
      await refresh();
    } catch (e) {
      fail(e);
    }
  }

  async function transfer(toUserId: string) {
    setFailed(false);
    try {
      await api(`${base}/transfer-ownership`, { body: { toUserId } });
      setTransferOpen(false);
      await qc.invalidateQueries({ queryKey: qk.me() });
      await refresh();
    } catch (e) {
      setTransferOpen(false);
      fail(e);
      throw e;
    }
  }

  const leaving = confirm !== null && confirm.userId === meId;

  return (
    <main className="family-page">
      <PageHeader title={family.name} gear />
      <p className="family-sub">{t("fam.subtitle", { n: num(list.length) })}</p>
      {failed && <Banner tone="danger">{t("fam.error")}</Banner>}
      <ul className="member-list">
        {list.map((m) => (
          <MemberRow
            key={m.userId}
            member={m}
            meId={meId}
            actorRole={role}
            onRoleChange={changeRole}
            onRemove={setConfirm}
          />
        ))}
        {pending.map((i) => (
          <li key={i.id} className="member-row member-row--pending">
            <span className="ui-avatar member-pending-avatar">?</span>
            <div className="member-main">
              <strong>{i.forPhoneMasked}</strong>
              <span>
                {t("fam.pending", {
                  n: num(Math.max(0, Math.ceil((new Date(i.expiresAt).getTime() - now) / DAY_MS))),
                })}
              </span>
            </div>
          </li>
        ))}
      </ul>
      {isAdmin && (
        <div className="family-actions">
          <Button size="lg" onClick={() => setInviteOpen(true)}>
            {t("fam.invitePhone")}
          </Button>
          <Button size="lg" variant="secondary" onClick={sendLink}>
            {t("fam.inviteLink")}
          </Button>
          {link && (
            <p role="status">
              {t("fam.linkReady")} <bdi>{link.url}</bdi> {link.copied && t("fam.linkCopied")}
            </p>
          )}
        </div>
      )}
      {role === "owner" && (
        <Button variant="secondary" onClick={() => setTransferOpen(true)}>
          {t("fam.transfer")}
        </Button>
      )}

      {isAdmin && (
        <InviteSheet
          open={inviteOpen}
          onClose={() => setInviteOpen(false)}
          roles={assignableRoles(role)}
          onSend={invitePhone}
        />
      )}
      {role === "owner" && (
        <TransferOwnershipDialog
          open={transferOpen}
          onClose={() => setTransferOpen(false)}
          admins={list.filter((m) => m.role === "admin")}
          onConfirm={transfer}
        />
      )}
      <Dialog
        open={confirm !== null}
        onClose={() => setConfirm(null)}
        title={t(leaving ? "leave" : "remove")}
        closeLabel={t("fam.close")}
      >
        <p>{leaving ? t("fam.confirmLeave") : t("fam.confirmRemove", { name: confirm ? memberName(confirm) : "" })}</p>
        <Button variant="danger" size="lg" onClick={removeConfirmed}>
          {t("fam.yes")}
        </Button>
        <Button variant="secondary" size="lg" onClick={() => setConfirm(null)}>
          {t("fam.cancel")}
        </Button>
      </Dialog>
      <Dialog
        open={limitOpen}
        onClose={() => setLimitOpen(false)}
        title={t("fam.limitTitle")}
        closeLabel={t("fam.close")}
      >
        <p>{t("fam.limitBody")}</p>
        <Link href="/plans" className="ui-btn ui-btn--primary" style={{ minHeight: 56 }}>
          {t("fam.limitLink")}
        </Link>
      </Dialog>
    </main>
  );
}
