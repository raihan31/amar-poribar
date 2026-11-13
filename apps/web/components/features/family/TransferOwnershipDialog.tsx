"use client";

import { useState } from "react";
import { useT } from "@/lib/i18n/useT";
import { Button } from "../../ui/Button";
import { Dialog } from "../../ui/Dialog";
import { memberName, type FamilyMember } from "./MemberRow";

export interface TransferOwnershipDialogProps {
  open: boolean;
  onClose: () => void;
  admins: FamilyMember[];
  onConfirm: (toUserId: string) => Promise<void>;
}

/** Owner picks one of the admins; the owner becomes an admin afterwards (SRS FR-FAM-04). */
export function TransferOwnershipDialog({ open, onClose, admins, onConfirm }: TransferOwnershipDialogProps) {
  const t = useT();
  const [picked, setPicked] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const target = picked ?? admins[0]?.userId ?? null;

  async function confirm() {
    if (!target) return;
    setBusy(true);
    try {
      await onConfirm(target);
    } catch {
      // the page reports the failure
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} onClose={onClose} title={t("fam.transfer")} closeLabel={t("fam.close")}>
      {admins.length === 0 ? (
        <p>{t("fam.noAdmins")}</p>
      ) : (
        <>
          <label className="field-label">
            {t("fam.transferPick")}
            <select className="role-select" value={target ?? ""} onChange={(e) => setPicked(e.target.value)}>
              {admins.map((a) => (
                <option key={a.userId} value={a.userId}>
                  {memberName(a)}
                </option>
              ))}
            </select>
          </label>
          <p>{t("fam.transferNote")}</p>
          <Button variant="danger" size="lg" disabled={busy || !target} onClick={confirm}>
            {t("fam.transfer")}
          </Button>
        </>
      )}
    </Dialog>
  );
}
