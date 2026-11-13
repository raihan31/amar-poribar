"use client";

import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/Button";
import { CopyButton } from "@/components/ui/CopyButton";
import { drawQr } from "@/lib/auth/qr";
import { TOTP_LENGTH, TotpInput } from "./TotpInput";

export function groupSecret(secret: string): string {
  return (secret.match(/.{1,4}/g) ?? []).join(" ");
}

export interface EnrollTotpProps {
  otpauthUri: string;
  secret: string;
  onConfirm: (code: string) => void;
  busy?: boolean;
  invalid?: boolean;
  describedBy?: string;
}

export function EnrollTotp({ otpauthUri, secret, onConfirm, busy, invalid, describedBy }: EnrollTotpProps) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const [code, setCode] = useState("");

  useEffect(() => {
    if (canvas.current) drawQr(canvas.current, otpauthUri).catch(() => {});
  }, [otpauthUri]);

  return (
    <section className="enroll" aria-label="Set up authenticator app">
      <p className="enroll__text">
        First sign-in: scan this code with your authenticator app, or type the key by hand. Then enter the 6-digit code
        to finish.
      </p>
      <canvas
        ref={canvas}
        className="enroll__qr"
        width={176}
        height={176}
        role="img"
        aria-label="QR code for authenticator app"
      />
      <div className="enroll__secret">
        <code>{groupSecret(secret)}</code>
        <CopyButton value={secret} />
      </div>
      <TotpInput
        label="6-digit code from your authenticator app"
        value={code}
        onChange={setCode}
        disabled={busy}
        invalid={invalid}
        describedBy={describedBy}
      />
      <Button variant="primary" disabled={busy || code.length !== TOTP_LENGTH} onClick={() => onConfirm(code)}>
        Confirm and sign in
      </Button>
    </section>
  );
}
