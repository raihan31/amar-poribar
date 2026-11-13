"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { PageTitle } from "@/components/shell/PageTitle";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { ReasonDialog } from "@/components/ui/ReasonDialog";
import { Toast } from "@/components/ui/Toast";
import { InviteStaffForm } from "@/components/staff/InviteStaffForm";
import { RoleMatrix } from "@/components/staff/RoleMatrix";
import { RoleSelect } from "@/components/staff/RoleSelect";
import { StaffTable } from "@/components/staff/StaffTable";
import type { StaffAction, StaffMember } from "@/components/staff/types";
import { api } from "@/lib/api/client";
import { qk } from "@/lib/api/queryKeys";
import { useStaff } from "@/lib/auth/useStaff";

const TITLE: Record<StaffAction, string> = {
  change_role: "Change role",
  remind: "Send reminder",
  disable: "Disable account",
  reset_totp: "Reset 2FA",
};

export default function StaffPage() {
  const staff = useStaff();
  const qc = useQueryClient();
  const [pending, setPending] = useState<{ action: StaffAction; member: StaffMember } | null>(null);
  const [role, setRole] = useState("support");
  const [toast, setToast] = useState<string | null>(null);
  const allowed = staff.can("manage_staff");

  const list = useQuery({
    queryKey: qk.staff(),
    queryFn: () => api<StaffMember[]>("/admin/v1/staff"),
    enabled: allowed,
  });
  const items = list.data ?? [];
  // The session carries the name only, so the own row is matched by name.
  const self = items.find((m) => m.name === staff.name);

  const refresh = () => qc.invalidateQueries({ queryKey: qk.staff() });
  const invite = useMutation({
    mutationFn: (body: { email: string; role: string }) =>
      api("/admin/v1/staff", { method: "POST", body, idempotent: true }),
    onSuccess: () => {
      setToast("Invite sent");
      return refresh();
    },
    onError: () => setToast("Could not send the invite. Try again."),
  });
  const patch = useMutation({
    mutationFn: (v: { id: string; body: Record<string, unknown> }) =>
      api(`/admin/v1/staff/${encodeURIComponent(v.id)}`, { method: "PATCH", body: v.body }),
    onSuccess: () => refresh(),
    onError: () => setToast("Could not save. Try again."),
  });

  if (staff.isLoading) return null;
  if (!allowed) {
    return (
      <div>
        <PageTitle title="Staff accounts" />
        <EmptyState title="You do not have access" hint="Only the Staff Owner can manage staff accounts." />
      </div>
    );
  }

  const confirm = (reason: string) => {
    if (!pending) return;
    const { action, member } = pending;
    const body: Record<string, unknown> =
      action === "change_role"
        ? { role, reason }
        : action === "disable"
          ? { disabled: true, reason }
          : action === "reset_totp"
            ? { resetTotp: true, reason }
            : { remind: true, reason };
    setPending(null);
    patch.mutate({ id: member.id, body });
  };

  return (
    <div>
      <PageTitle
        title="Staff accounts"
        subtitle="Staff sign in with email, password and a 2FA code. Every action is written to the audit log."
      />
      <StaffTable
        items={items}
        selfId={self?.id}
        loading={list.isLoading}
        onAction={(action, member) => {
          setRole(member.role);
          setPending({ action, member });
        }}
      />
      <InviteStaffForm busy={invite.isPending} onInvite={(v) => invite.mutate(v)} />
      <Card title="What each role can do">
        <RoleMatrix />
      </Card>
      <ReasonDialog
        open={pending !== null}
        title={pending ? `${TITLE[pending.action]}: ${pending.member.name}` : ""}
        confirmLabel={pending ? TITLE[pending.action] : undefined}
        danger={pending?.action === "disable"}
        extra={
          pending?.action === "change_role" ? <RoleSelect label="New role" value={role} onChange={setRole} /> : null
        }
        onCancel={() => setPending(null)}
        onConfirm={confirm}
      />
      <Toast message={toast} onDone={() => setToast(null)} />
    </div>
  );
}
