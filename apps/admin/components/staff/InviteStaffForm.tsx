"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { TextField } from "@/components/ui/TextField";
import { RoleSelect } from "./RoleSelect";

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function InviteStaffForm({
  onInvite,
  busy,
}: {
  onInvite: (v: { email: string; role: string }) => void;
  busy?: boolean;
}) {
  const [email, setEmail] = useState("");
  const [role, setRole] = useState("support");
  const [error, setError] = useState<string | undefined>();

  return (
    <Card title="Invite staff">
      <form
        noValidate
        onSubmit={(e) => {
          e.preventDefault();
          const v = email.trim();
          if (!EMAIL.test(v)) {
            setError("Enter a valid work email");
            return;
          }
          setError(undefined);
          onInvite({ email: v, role });
        }}
      >
        <TextField
          label="Work email"
          type="email"
          placeholder="name@amarporibar.example"
          value={email}
          error={error}
          onChange={(e) => setEmail(e.target.value)}
        />
        <RoleSelect value={role} onChange={setRole} />
        <Button type="submit" variant="primary" disabled={busy}>
          Send invite
        </Button>
        <p className="muted">The invite link works for 48 hours. 2FA setup is required at first sign-in.</p>
      </form>
    </Card>
  );
}
