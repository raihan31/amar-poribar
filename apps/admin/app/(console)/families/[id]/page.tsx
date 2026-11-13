"use client";

import { useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { AddQuotaDialog } from "@/components/family/AddQuotaDialog";
import { ChangePlanDialog } from "@/components/family/ChangePlanDialog";
import { MembersCard } from "@/components/family/MembersCard";
import { PlanQuotaCard } from "@/components/family/PlanQuotaCard";
import { RiskyActionsCard } from "@/components/family/RiskyActionsCard";
import { StaffActionsCard } from "@/components/family/StaffActionsCard";
import { TransferOwnershipDialog } from "@/components/family/TransferOwnershipDialog";
import { UsageCard } from "@/components/family/UsageCard";
import { fmtDate, shortId } from "@/components/family/types";
import { FamilyStatusPill } from "@/components/families/FamilyStatusPill";
import { Toast } from "@/components/ui/Toast";
import { useFamilyDetail } from "@/lib/api/hooks/useFamilyDetail";
import { useStaff } from "@/lib/auth/useStaff";

type Dialog = "plan" | "quota" | "transfer" | null;

export default function FamilyPage() {
  const { id } = useParams<{ id: string }>();
  const staff = useStaff();
  const { data: f, isLoading, isError } = useFamilyDetail(id);
  const [dialog, setDialog] = useState<Dialog>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [scheduled, setScheduled] = useState<string | null>(null);

  if (isLoading) return <p className="muted">Loading…</p>;
  if (isError || !f) return <p role="alert">Could not load this family.</p>;

  const canPlan = staff.can("change_plan");
  const canTransfer = staff.can("handle_privacy");
  const readOnly = staff.role !== undefined && !canPlan && !canTransfer;
  const done = () => {
    setDialog(null);
    setToast("Done. Recorded in the audit log.");
  };
  const failed = () => setToast("Could not save. Try again.");
  const deletion = scheduled ?? f.deletionScheduledFor ?? null;

  return (
    <div>
      <Link href="/families" style={{ fontWeight: 600 }}>
        ← All families
      </Link>
      <header className="page-title">
        <div>
          <h1>{f.name}</h1>
          <p className="muted">
            Created {fmtDate(f.createdAt)} · ID {shortId(f.id)}
          </p>
        </div>
        <FamilyStatusPill status={f.status} />
      </header>
      {deletion && (
        <div role="status" className="kpi" style={{ marginBottom: 14 }}>
          Deletion scheduled for {fmtDate(deletion)}. <Link href="/privacy">Open privacy requests</Link>
        </div>
      )}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))",
          gap: 14,
          alignItems: "start",
        }}
      >
        <MembersCard
          members={f.members}
          pendingInvites={f.pendingInvites}
          canTransfer={canTransfer}
          readOnly={readOnly}
          onTransfer={() => setDialog("transfer")}
        />
        <PlanQuotaCard
          plan={f.plan}
          ai={f.ai}
          canChange={canPlan}
          readOnly={readOnly}
          onChangePlan={() => setDialog("plan")}
          onAddQuota={() => setDialog("quota")}
        />
        <UsageCard usage={f.usage} />
        <StaffActionsCard familyId={f.id} actions={f.recentActions} />
      </div>
      <RiskyActionsCard
        familyId={f.id}
        familyName={f.name}
        status={f.status}
        staffRole={staff.role}
        onError={failed}
        onDone={(res) => {
          const when = res && typeof res.scheduledFor === "string" ? res.scheduledFor : null;
          if (when) setScheduled(when);
          done();
        }}
      />
      <ChangePlanDialog
        key={f.plan}
        open={dialog === "plan"}
        familyId={f.id}
        current={f.plan}
        onDone={done}
        onError={failed}
        onCancel={() => setDialog(null)}
      />
      <AddQuotaDialog
        open={dialog === "quota"}
        familyId={f.id}
        onDone={done}
        onError={failed}
        onCancel={() => setDialog(null)}
      />
      <TransferOwnershipDialog
        open={dialog === "transfer"}
        familyId={f.id}
        members={f.members}
        onDone={done}
        onError={failed}
        onCancel={() => setDialog(null)}
      />
      <Toast message={toast} onDone={() => setToast(null)} />
    </div>
  );
}
