"use client";

import { useState } from "react";
import { ReasonDialog } from "@/components/ui/ReasonDialog";
import { SelectField } from "@/components/ui/SelectField";
import { useFamilyAction } from "@/lib/api/hooks/useFamilyAction";
import type { FamilyMember } from "./types";

export function TransferOwnershipDialog({
  open,
  familyId,
  members,
  onDone,
  onCancel,
  onError,
}: {
  open: boolean;
  familyId: string;
  members: FamilyMember[];
  onDone: () => void;
  onCancel: () => void;
  onError?: (e: unknown) => void;
}) {
  const eligible = members.filter((m) => (m.role === "admin" || m.role === "member") && m.userId);
  const [picked, setPicked] = useState("");
  const toUserId = picked || eligible[0]?.userId || "";
  const action = useFamilyAction(familyId);
  return (
    <ReasonDialog
      open={open}
      title="Transfer ownership"
      confirmLabel="Transfer ownership"
      extraValid={toUserId !== ""}
      extra={
        <SelectField
          label="New owner"
          options={eligible.map((m) => ({ value: m.userId as string, label: `${m.displayName} (${m.phoneMasked})` }))}
          value={toUserId}
          onChange={(e) => setPicked(e.target.value)}
        />
      }
      onCancel={onCancel}
      onConfirm={(reason) =>
        action.mutate({ action: "transfer-ownership", body: { toUserId, reason } }, { onSuccess: onDone, onError })
      }
    />
  );
}
