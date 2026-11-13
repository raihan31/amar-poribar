"use client";

import { useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { qk } from "@/lib/api/queryKeys";
import { useFormat } from "@/lib/i18n/format";
import { useT } from "@/lib/i18n/useT";
import type { Family } from "@/lib/types";
import { useFamily } from "../../shell/useFamily";
import { Avatar } from "../../ui/Avatar";
import { ROLE_KEY } from "./RoleSelect";

export interface FamilyCardProps {
  family: Family & { memberCount?: number };
  active: boolean;
  /** Unread messages; only known for the open family. */
  unread?: number;
  budgetAlerts?: number;
}

/** F2: one big tappable card per family. Selecting it switches `ap_fid` and drops the old family's cache. */
export function FamilyCard({ family, active, unread = 0, budgetAlerts = 0 }: FamilyCardProps) {
  const t = useT();
  const { num } = useFormat();
  const router = useRouter();
  const qc = useQueryClient();
  const { family: current, switchFamily } = useFamily();

  function select() {
    if (family.id !== current.id) {
      qc.removeQueries({ queryKey: qk.family(current.id).all });
      switchFamily(family.id);
    }
    router.push("/");
  }

  return (
    <button type="button" className={`family-card${active ? " family-card--active" : ""}`} onClick={select}>
      <Avatar name={family.name} size={56} />
      <span className="family-card-main">
        <strong>{family.name}</strong>
        <span className="family-card-meta">
          <span className="role-pill">{t(ROLE_KEY[family.role])}</span>
          {family.memberCount !== undefined && <span>{t("sw.members", { n: num(family.memberCount) })}</span>}
        </span>
        {active && <span className="family-card-active">{t("sw.active")}</span>}
        <span className="family-card-badges">
          {unread > 0 && <span className="badge">{t("nav.unread", { n: num(unread) })}</span>}
          {budgetAlerts > 0 && <span className="badge badge--warn">{t("sw.budgets", { n: num(budgetAlerts) })}</span>}
        </span>
      </span>
    </button>
  );
}
