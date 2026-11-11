"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { useStaff } from "@/lib/auth/useStaff";
import { ROLE_LABEL } from "@/lib/permissions";

export function SessionBar() {
  const { name, role } = useStaff();
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  async function signOut() {
    setBusy(true);
    await fetch("/api/staff/logout", { method: "POST", headers: { "x-ap-csrf": "1" } }).catch(() => null);
    router.replace("/login");
  }
  return (
    <div className="session-bar">
      <span className="session-bar__name">{name ?? ""}</span>
      {role && <span className="chip">{ROLE_LABEL[role]}</span>}
      <button type="button" className="ui-btn ui-btn--secondary" onClick={signOut} disabled={busy}>
        Sign out
      </button>
    </div>
  );
}
