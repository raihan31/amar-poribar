"use client";

import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { Button } from "./Button";

export const MIN_REASON = 10;

export interface ReasonDialogProps {
  open: boolean;
  title: string;
  confirmLabel?: string;
  danger?: boolean;
  onConfirm: (reason: string) => void;
  onCancel: () => void;
  /** Extra controls rendered above the reason box; `extraValid` gates the confirm button. */
  extra?: ReactNode;
  extraValid?: boolean;
}

export function ReasonDialog({
  open,
  title,
  confirmLabel = "Confirm",
  danger,
  onConfirm,
  onCancel,
  extra,
  extraValid = true,
}: ReasonDialogProps) {
  const [reason, setReason] = useState("");
  const id = useId();
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (open && !el.open) {
      if (typeof el.showModal === "function") el.showModal();
      else el.setAttribute("open", "");
    } else if (!open && el.open) {
      if (typeof el.close === "function") el.close();
      else el.removeAttribute("open");
    }
  }, [open]);

  const close = () => {
    setReason("");
    onCancel();
  };
  const valid = reason.trim().length >= MIN_REASON && extraValid;
  return (
    <dialog
      ref={ref}
      className="dialog"
      aria-label={title}
      onCancel={(e) => {
        e.preventDefault();
        close();
      }}
    >
      <h2>{title}</h2>
      {extra}
      <div className="field">
        <label htmlFor={id}>Reason (required, at least 10 characters)</label>
        <textarea id={id} value={reason} onChange={(e) => setReason(e.target.value)} rows={3} />
        <span className="muted" aria-live="polite">
          {reason.trim().length} / {MIN_REASON}
        </span>
      </div>
      <div className="row">
        <Button onClick={close}>Cancel</Button>
        <Button
          variant={danger ? "danger" : "primary"}
          disabled={!valid}
          onClick={() => {
            const r = reason.trim();
            setReason("");
            onConfirm(r);
          }}
        >
          {confirmLabel}
        </Button>
      </div>
    </dialog>
  );
}
