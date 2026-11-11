"use client";

import { ReasonDialog } from "@/components/ui/ReasonDialog";

/** Reject with a reason of at least 10 characters (enforced by ReasonDialog). */
export function RejectDialog({
  open,
  requestId,
  onConfirm,
  onCancel,
}: {
  open: boolean;
  requestId: string;
  onConfirm: (reason: string) => void;
  onCancel: () => void;
}) {
  return (
    <ReasonDialog
      open={open}
      title={`Reject ${requestId}`}
      confirmLabel="Reject request"
      danger
      onConfirm={onConfirm}
      onCancel={onCancel}
    />
  );
}
