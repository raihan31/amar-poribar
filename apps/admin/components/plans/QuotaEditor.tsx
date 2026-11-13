"use client";

import { useId, useState } from "react";
import { Button } from "@/components/ui/Button";
import { ReasonDialog } from "@/components/ui/ReasonDialog";

/** AI entries per month: a positive whole number, saved with a reason. */
export function QuotaEditor({
  value,
  busy,
  onSave,
}: {
  value: number;
  busy?: boolean;
  onSave: (aiQuotaMonth: number, reason: string) => void;
}) {
  const id = useId();
  const [raw, setRaw] = useState(String(value));
  const [asking, setAsking] = useState(false);
  const n = Number(raw);
  const valid = /^\d+$/.test(raw.trim()) && Number.isInteger(n) && n >= 1;
  return (
    <div className="field">
      <label htmlFor={id}>AI entries per month</label>
      <div className="row" style={{ gap: 8 }}>
        <input
          id={id}
          type="number"
          min={1}
          step={1}
          value={raw}
          aria-invalid={valid ? undefined : true}
          onChange={(e) => setRaw(e.target.value)}
        />
        <Button disabled={!valid || busy} onClick={() => setAsking(true)}>
          Save
        </Button>
      </div>
      {!valid && <span className="error">Enter a whole number of 1 or more.</span>}
      <ReasonDialog
        open={asking}
        title="Change AI quota"
        confirmLabel="Save quota"
        onCancel={() => setAsking(false)}
        onConfirm={(reason) => {
          setAsking(false);
          onSave(n, reason);
        }}
      />
    </div>
  );
}
