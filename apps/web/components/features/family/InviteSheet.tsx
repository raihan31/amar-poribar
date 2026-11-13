"use client";

import { useState } from "react";
import { BdPhoneSchema } from "@amar-poribar/shared";
import { useT } from "@/lib/i18n/useT";
import type { RoleName } from "@/lib/types";
import { Button } from "../../ui/Button";
import { Sheet } from "../../ui/Sheet";
import { RoleSelect } from "./RoleSelect";

export interface InviteSheetProps {
  open: boolean;
  onClose: () => void;
  /** Roles the actor may hand out. */
  roles: RoleName[];
  /** Resolves when the invite was sent; rejects to keep the sheet open. */
  onSend: (input: { phone: string; role: RoleName }) => Promise<void>;
}

/** "+ নম্বর দিয়ে ডাকুন": invite one person by mobile number with a role. */
export function InviteSheet({ open, onClose, roles, onSend }: InviteSheetProps) {
  const t = useT();
  const [phone, setPhone] = useState("");
  const [role, setRole] = useState<RoleName>("member");
  const [invalid, setInvalid] = useState(false);
  const [busy, setBusy] = useState(false);

  async function submit() {
    const parsed = BdPhoneSchema.safeParse(phone.trim());
    if (!parsed.success) {
      setInvalid(true);
      return;
    }
    setInvalid(false);
    setBusy(true);
    try {
      await onSend({ phone: phone.trim(), role });
      setPhone("");
    } catch {
      // the page reports the failure; keep what was typed
    } finally {
      setBusy(false);
    }
  }

  return (
    <Sheet open={open} onClose={onClose} title={t("fam.invitePhone")} closeLabel={t("fam.close")}>
      <label className="field-label">
        {t("fam.phoneLabel")}
        <input
          className="field-input"
          type="tel"
          inputMode="tel"
          autoComplete="off"
          value={phone}
          aria-invalid={invalid}
          onChange={(e) => setPhone(e.target.value)}
        />
      </label>
      {invalid && <p role="alert">{t("fam.phoneInvalid")}</p>}
      <label className="field-label">
        {t("fam.roleLabel")}
        <RoleSelect value={role} options={roles} label={t("fam.roleLabel")} onChange={setRole} />
      </label>
      <Button size="lg" disabled={busy} onClick={submit}>
        {t("fam.send")}
      </Button>
    </Sheet>
  );
}
