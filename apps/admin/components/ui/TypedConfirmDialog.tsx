"use client";

import { useState } from "react";
import { ReasonDialog, type ReasonDialogProps } from "./ReasonDialog";
import { TextField } from "./TextField";

export interface TypedConfirmDialogProps extends Omit<ReasonDialogProps, "extra" | "extraValid" | "danger"> {
  /** The exact name the operator must type (compared after Unicode NFC normalisation). */
  expected: string;
  /** Optional checkbox label; when set the confirm button also needs it ticked. */
  acknowledge?: string;
}

export function TypedConfirmDialog({ expected, acknowledge, ...rest }: TypedConfirmDialogProps) {
  const [typed, setTyped] = useState("");
  const [checked, setChecked] = useState(false);
  const match = typed.normalize("NFC") === expected.normalize("NFC");
  return (
    <ReasonDialog
      {...rest}
      danger
      extraValid={match && (!acknowledge || checked)}
      extra={
        <>
          <TextField label="Type the family name to confirm" value={typed} onChange={(e) => setTyped(e.target.value)} />
          {acknowledge && (
            <label className="row" style={{ gap: 8, marginBottom: 12 }}>
              <input type="checkbox" checked={checked} onChange={(e) => setChecked(e.target.checked)} />
              {acknowledge}
            </label>
          )}
        </>
      }
    />
  );
}
