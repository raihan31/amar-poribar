"use client";

import { useEffect, useRef, type KeyboardEvent, type ReactNode } from "react";
import { cx } from "./cx";
import { IconButton } from "./IconButton";

export interface DialogProps {
  open: boolean;
  onClose: () => void;
  title: string;
  /** Accessible name of the close button. */
  closeLabel: string;
  /** When true, Escape does not close and no close button is shown. */
  blocking?: boolean;
  className?: string;
  children: ReactNode;
}

const FOCUSABLE =
  'button:not([disabled]), [href], input:not([disabled]), select, textarea, [tabindex]:not([tabindex="-1"])';

export function Dialog({ open, onClose, title, closeLabel, blocking = false, className, children }: DialogProps) {
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (open && !el.open) {
      if (typeof el.showModal === "function") el.showModal();
      else el.setAttribute("open", "");
      el.querySelector<HTMLElement>(FOCUSABLE)?.focus();
    } else if (!open && el.open) {
      if (typeof el.close === "function") el.close();
      else el.removeAttribute("open");
    }
  }, [open]);

  const onKeyDown = (e: KeyboardEvent<HTMLDialogElement>) => {
    if (e.key === "Escape") {
      e.preventDefault();
      if (!blocking) onClose();
      return;
    }
    if (e.key !== "Tab") return;
    const items = Array.from(e.currentTarget.querySelectorAll<HTMLElement>(FOCUSABLE));
    if (items.length === 0) return;
    const first = items[0]!;
    const last = items[items.length - 1]!;
    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault();
      first.focus();
    }
  };

  return (
    <dialog
      ref={ref}
      aria-label={title}
      className={cx("ui-dialog", className)}
      onKeyDown={onKeyDown}
      onCancel={(e) => {
        e.preventDefault();
        if (!blocking) onClose();
      }}
    >
      <h2>{title}</h2>
      {!blocking && <IconButton icon="close" label={closeLabel} onClick={onClose} />}
      {children}
    </dialog>
  );
}
