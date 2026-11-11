"use client";

import { useState } from "react";
import { useT } from "@/lib/i18n/useT";
import { useFormat } from "@/lib/i18n/format";
import type { RoleName } from "@/lib/types";
import { Avatar } from "../../ui/Avatar";
import { Button } from "../../ui/Button";
import { Card } from "../../ui/Card";
import { Icon } from "../../ui/icons";

export interface InvitePreviewData {
  familyName: string;
  memberCount: number;
  inviter?: { id?: string; name: string };
  role: RoleName;
  expiresAt: string;
}

export interface InvitePreviewProps {
  data: InvitePreviewData;
  onAccept: () => void;
  onDecline: () => void;
  busy?: boolean;
  error?: string | null;
  /** Clock override for tests. */
  now?: number;
}

const DAY_MS = 86_400_000;
const ROLE_KEY = { owner: "roleOwner", admin: "roleAdmin", member: "roleMember", viewer: "roleViewer" } as const;

/** A6: who invited you, to which family, what you can do and how long the link lasts. */
export function InvitePreview({ data, onAccept, onDecline, busy, error, now: nowProp }: InvitePreviewProps) {
  const t = useT();
  const [mountedAt] = useState(() => Date.now());
  const now = nowProp ?? mountedAt;
  const f = useFormat();
  const daysLeft = Math.max(0, Math.ceil((new Date(data.expiresAt).getTime() - now) / DAY_MS));
  const name = data.inviter?.name ?? "";
  const faces = [name || data.familyName, data.familyName, data.familyName];

  return (
    <section className="invite">
      <div className="invite__faces" style={{ display: "flex", justifyContent: "center" }}>
        {faces.map((n, i) => (
          <span key={i} style={{ marginLeft: i === 0 ? 0 : -16 }}>
            <Avatar name={n} size={72} />
          </span>
        ))}
      </div>
      <h1 className="invite__title" style={{ textAlign: "center", fontSize: 22, margin: "16px 0 4px" }}>
        {t("join.invitedBy", { name })}
      </h1>
      <p
        className="invite__family"
        style={{ textAlign: "center", fontSize: 32, fontWeight: 700, margin: 0, color: "var(--green-700)" }}
      >
        {data.familyName}
      </p>
      <p style={{ textAlign: "center" }}>
        {t("join.meta", { n: f.num(data.memberCount) })} <strong>{t(ROLE_KEY[data.role])}</strong>
      </p>
      <Card>
        <h2 style={{ fontSize: 18, margin: "0 0 8px" }}>{t("join.canTitle")}</h2>
        <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "grid", gap: 8 }}>
          {(["join.can1", "join.can2", "join.can3"] as const).map((k) => (
            <li key={k} style={{ display: "flex", gap: 8, alignItems: "center" }}>
              <Icon name="check" size={20} />
              {t(k)}
            </li>
          ))}
        </ul>
      </Card>
      <p style={{ textAlign: "center" }}>{t("join.daysLeft", { n: f.num(daysLeft) })}</p>
      {error && (
        <p role="alert" className="error">
          {error}
        </p>
      )}
      <Button size="xl" disabled={busy} onClick={onAccept} style={{ width: "100%", minHeight: 76 }}>
        {t("join.accept")}
      </Button>
      <Button variant="secondary" onClick={onDecline} style={{ width: "100%" }}>
        {t("join.decline")}
      </Button>
    </section>
  );
}
