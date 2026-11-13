"use client";

import { useState } from "react";
import { ReasonDialog } from "@/components/ui/ReasonDialog";
import { TextField } from "@/components/ui/TextField";
import { useFamilyAction } from "@/lib/api/hooks/useFamilyAction";

export function AddQuotaDialog({
  open,
  familyId,
  onDone,
  onCancel,
  onError,
}: {
  open: boolean;
  familyId: string;
  onDone: () => void;
  onCancel: () => void;
  onError?: (e: unknown) => void;
}) {
  const [raw, setRaw] = useState("50");
  const add = Number(raw);
  const valid = Number.isInteger(add) && add >= 1 && add <= 500;
  const action = useFamilyAction(familyId);
  return (
    <ReasonDialog
      open={open}
      title="Add AI entries"
      confirmLabel="Add entries"
      extraValid={valid}
      extra={
        <TextField
          label="Entries to add (1 to 500)"
          type="number"
          min={1}
          max={500}
          step={1}
          value={raw}
          onChange={(e) => setRaw(e.target.value)}
          error={valid ? undefined : "Enter a whole number from 1 to 500."}
        />
      }
      onCancel={onCancel}
      onConfirm={(reason) => action.mutate({ action: "quota", body: { add, reason } }, { onSuccess: onDone, onError })}
    />
  );
}
