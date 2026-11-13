"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { ReasonDialog } from "@/components/ui/ReasonDialog";
import { TextField } from "@/components/ui/TextField";
import { QuotaEditor } from "./QuotaEditor";
import { fmtCount, priceText, type PlanChange, type PlanRow } from "./types";

function PricingEditor({
  plan,
  busy,
  onSave,
}: {
  plan: PlanRow;
  busy?: boolean;
  onSave: (change: PlanChange, reason: string) => void;
}) {
  const [price, setPrice] = useState(String(Math.trunc(plan.priceMonthPaisa / 100)));
  const [members, setMembers] = useState(String(plan.memberLimit ?? ""));
  const [asking, setAsking] = useState(false);
  const priceOk = /^\d+$/.test(price.trim());
  const membersOk = /^\d+$/.test(members.trim()) && Number(members) >= 1;
  return (
    <div style={{ marginTop: 10 }}>
      <TextField
        label="Monthly price (৳)"
        type="number"
        min={0}
        step={1}
        value={price}
        onChange={(e) => setPrice(e.target.value)}
      />
      <TextField
        label="Member limit"
        type="number"
        min={1}
        step={1}
        value={members}
        onChange={(e) => setMembers(e.target.value)}
      />
      <Button disabled={!priceOk || !membersOk || busy} onClick={() => setAsking(true)}>
        Save price and limit
      </Button>
      <ReasonDialog
        open={asking}
        title={`Change ${plan.name} price and limit`}
        confirmLabel="Save price and limit"
        onCancel={() => setAsking(false)}
        onConfirm={(reason) => {
          setAsking(false);
          onSave({ priceMonthPaisa: Number(price) * 100, memberLimit: Number(members) }, reason);
        }}
      />
    </div>
  );
}

export function PlanCard({
  plan,
  canEditQuota,
  canEditPricing,
  busy,
  onSave,
}: {
  plan: PlanRow;
  canEditQuota: boolean;
  /** Staff owner only. */
  canEditPricing: boolean;
  busy?: boolean;
  onSave: (change: PlanChange, reason: string) => void;
}) {
  return (
    <Card>
      <div className="row" style={{ justifyContent: "space-between", gap: 8 }}>
        <h2 style={{ fontSize: 18, margin: 0 }}>{plan.name}</h2>
        <span className="muted">{fmtCount(plan.families)} families</span>
      </div>
      <p style={{ fontSize: 20, fontWeight: 700, margin: "8px 0" }}>{priceText(plan)}</p>
      <ul style={{ margin: "0 0 12px", paddingLeft: 18 }}>
        {plan.summary.map((s) => (
          <li key={s}>{s}</li>
        ))}
      </ul>
      {canEditQuota && (
        <QuotaEditor
          key={plan.aiQuotaMonth}
          value={plan.aiQuotaMonth}
          busy={busy}
          onSave={(q, r) => onSave({ aiQuotaMonth: q }, r)}
        />
      )}
      {canEditPricing && <PricingEditor plan={plan} busy={busy} onSave={onSave} />}
    </Card>
  );
}
