"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { PageTitle } from "@/components/shell/PageTitle";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Toast } from "@/components/ui/Toast";
import { RejectDialog } from "@/components/privacy/RejectDialog";
import { RequestTable } from "@/components/privacy/RequestTable";
import { RequestTabs } from "@/components/privacy/RequestTabs";
import { StepList } from "@/components/privacy/StepList";
import type { PrivacyList, PrivacyStatus } from "@/components/privacy/types";
import { api } from "@/lib/api/client";
import { qk } from "@/lib/api/queryKeys";
import { useStaff } from "@/lib/auth/useStaff";

const KIND = { delete: "Delete account", export: "Export my data" } as const;

export default function PrivacyPage() {
  const staff = useStaff();
  const qc = useQueryClient();
  const [status, setStatus] = useState<PrivacyStatus>("open");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [rejecting, setRejecting] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const canAct = staff.can("handle_privacy");

  const list = useQuery({
    queryKey: [...qk.privacy(), status],
    queryFn: () => api<PrivacyList>(`/admin/v1/privacy-requests?status=${status}`),
  });
  const items = list.data?.items ?? [];
  const selected = items.find((r) => r.id === selectedId) ?? null;

  const act = useMutation({
    mutationFn: (v: { id: string; body: { action: string; reason?: string } }) =>
      api(
        `/admin/v1/privacy-requests/${encodeURIComponent(v.id)}/${v.body.action === "reject" ? "reject" : "advance"}`,
        {
          method: "POST",
          body: v.body.action === "reject" ? { reason: v.body.reason } : v.body,
          idempotent: true,
        },
      ),
    onSuccess: () => qc.invalidateQueries({ queryKey: qk.privacy() }),
    onError: () => setToast("Could not save. Try again."),
  });

  const advance = (id: string) => act.mutate({ id, body: { action: "continue" } });

  return (
    <div>
      <PageTitle
        title="Privacy requests"
        subtitle="Data export and deletion must be finished within 30 days of the request (PDPO 2025)."
      />
      <RequestTabs
        value={status}
        counts={list.data?.counts}
        onChange={(s) => {
          setStatus(s);
          setSelectedId(null);
        }}
      />
      <RequestTable
        items={items}
        loading={list.isLoading}
        canAct={canAct && status === "open"}
        selectedId={selectedId}
        onSelect={(r) => setSelectedId(r.id)}
        onContinue={(r) => {
          setSelectedId(r.id);
          advance(r.id);
        }}
      />
      {selected && (
        <Card title={`${selected.id} · ${KIND[selected.kind]}`}>
          <p className="muted">Steps are done in order. Each one is written to the audit log.</p>
          <StepList steps={selected.steps} />
          {canAct && status === "open" && (
            <div className="row" style={{ gap: 12, marginTop: 12 }}>
              <Button
                onClick={() => act.mutate({ id: selected.id, body: { action: "notify_owner" } })}
                disabled={act.isPending}
              >
                Message the owner
              </Button>
              <Button variant="danger" onClick={() => setRejecting(true)}>
                Reject with reason…
              </Button>
            </div>
          )}
          <RejectDialog
            open={rejecting}
            requestId={selected.id}
            onCancel={() => setRejecting(false)}
            onConfirm={(reason) => {
              setRejecting(false);
              act.mutate({ id: selected.id, body: { action: "reject", reason } });
            }}
          />
        </Card>
      )}
      <Toast message={toast} onDone={() => setToast(null)} />
    </div>
  );
}
