"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { ReasonDialog } from "@/components/ui/ReasonDialog";
import { TypedConfirmDialog } from "@/components/ui/TypedConfirmDialog";
import type { FamilyStatus } from "@/lib/api/hooks/useFamilies";
import { useFamilyAction } from "@/lib/api/hooks/useFamilyAction";
import { can } from "@/lib/permissions";

type Dialog = "suspend" | "unsuspend" | "delete" | null;

/** Owner-only. Renders nothing for roles without suspend or delete rights. */
export function RiskyActionsCard({
  familyId,
  familyName,
  status,
  staffRole,
  onDone,
  onError,
}: {
  familyId: string;
  familyName: string;
  status: FamilyStatus;
  staffRole: string | undefined;
  onDone: (result?: Record<string, unknown>) => void;
  onError?: (e: unknown) => void;
}) {
  const [dialog, setDialog] = useState<Dialog>(null);
  const action = useFamilyAction(familyId);
  const canSuspend = can(staffRole, "suspend");
  const canDelete = can(staffRole, "delete_data");
  if (!canSuspend && !canDelete) return null;

  const close = () => setDialog(null);
  const run = (name: "suspend" | "unsuspend" | "delete", body: Record<string, unknown>) =>
    action.mutate(
      { action: name, body },
      {
        onSuccess: (res) => {
          close();
          onDone(res);
        },
        onError,
      },
    );
  const suspended = status === "suspended";

  return (
    <section className="kpi" style={{ background: "#FFF6F4", borderColor: "#E3B1AB", marginTop: 14 }}>
      <h2 style={{ fontSize: 16, margin: "0 0 12px" }}>Risky actions</h2>
      <p>
        Each action asks for a reason, then you type the family name to confirm. It is written to the audit log with
        your name.
      </p>
      <div className="row" style={{ gap: 10, flexWrap: "wrap" }}>
        {canSuspend && (
          <Button
            style={{ color: "#B3261E", borderColor: "#B3261E" }}
            onClick={() => setDialog(suspended ? "unsuspend" : "suspend")}
          >
            {suspended ? "Unsuspend family" : "Suspend family"}
          </Button>
        )}
        {canDelete && (
          <Button variant="danger" onClick={() => setDialog("delete")}>
            Delete family and data…
          </Button>
        )}
      </div>
      <TypedConfirmDialog
        open={dialog === "suspend"}
        title="Suspend family"
        confirmLabel="Suspend"
        expected={familyName}
        onCancel={close}
        onConfirm={(reason) => run("suspend", { reason, confirmFamilyName: familyName })}
      />
      <ReasonDialog
        open={dialog === "unsuspend"}
        title="Unsuspend family"
        confirmLabel="Unsuspend"
        onCancel={close}
        onConfirm={(reason) => run("unsuspend", { reason })}
      />
      <TypedConfirmDialog
        open={dialog === "delete"}
        title="Delete family and data"
        confirmLabel="Delete family"
        expected={familyName}
        acknowledge="I understand this starts the 30-day deletion process"
        onCancel={close}
        onConfirm={(reason) => run("delete", { reason, confirmFamilyName: familyName })}
      />
    </section>
  );
}
