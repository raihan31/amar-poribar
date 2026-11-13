import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import type { FamilyMember, MemberRole, PendingInvite } from "./types";

const LABEL: Record<MemberRole, string> = { owner: "Owner", admin: "Admin", member: "Member", viewer: "Viewer" };
const DAY = 86_400_000;

export function MembersCard({
  members,
  pendingInvites,
  canTransfer,
  readOnly,
  onTransfer,
  now = new Date(),
}: {
  members: FamilyMember[];
  pendingInvites: PendingInvite[];
  canTransfer: boolean;
  readOnly?: boolean;
  onTransfer: () => void;
  now?: Date;
}) {
  return (
    <Card title={`Members (${members.length})`}>
      <ul style={{ listStyle: "none", margin: 0, padding: 0 }}>
        {members.map((m, i) => (
          <li className="row" style={{ gap: 10, padding: "8px 0" }} key={m.userId ?? i}>
            <b style={{ flex: 1 }}>{m.displayName}</b>
            <span className="muted">{m.phoneMasked}</span>
            <span
              className={`role-pill role-pill--${m.role}`}
              style={{
                borderRadius: 12,
                padding: "2px 10px",
                fontSize: 13,
                fontWeight: 600,
                background: m.role === "owner" ? "#CDE8C8" : "#F1E6D3",
              }}
            >
              {LABEL[m.role]}
            </span>
          </li>
        ))}
        {pendingInvites.map((p, i) => {
          const days = Math.max(0, Math.ceil((new Date(p.expiresAt).getTime() - now.getTime()) / DAY));
          return (
            <li className="row" style={{ gap: 10, padding: "8px 0" }} key={`inv${i}`}>
              <span className="muted" style={{ flex: 1 }}>
                Pending invite
              </span>
              <span className="muted">
                {p.phoneMasked} · {days} {days === 1 ? "day" : "days"} left
              </span>
            </li>
          );
        })}
      </ul>
      {canTransfer && (
        <Button style={{ width: "100%", marginTop: 10 }} onClick={onTransfer}>
          Transfer ownership…
        </Button>
      )}
      {readOnly && <p className="muted">You have read-only access.</p>}
    </Card>
  );
}
