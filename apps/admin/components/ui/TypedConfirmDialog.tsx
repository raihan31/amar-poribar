"use client";

import { useState } from "react";
import { ReasonDialog, type ReasonDialogProps } from "./ReasonDialog";
import { TextField } from "./TextField";

export interface TypedConfirmDialogProps extends Omit<ReasonDialogProps, "extra" | "extraValid" | "danger"> {
  /** The exact name the operator must type (compared after Unicode NFC normalisation). */
  expected: string;
}

export function TypedConfirmDialog({ expected, ...rest }: TypedConfirmDialogProps) {
  const [typed, setTyped] = useState("");
  const match = typed.normalize("NFC") === expected.normalize("NFC");
  return (
    <ReasonDialog
      {...rest}
      danger
      extraValid={match}
      extra={
        <TextField label="Type the family name to confirm" value={typed} onChange={(e) => setTyped(e.target.value)} />
      }
    />
  );
}
