export function PrivacyNote() {
  return (
    <div
      className="kpi"
      style={{
        display: "flex",
        gap: 12,
        alignItems: "center",
        background: "var(--green-100)",
        color: "var(--green-700)",
      }}
    >
      <svg
        width="26"
        height="26"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <rect x="5" y="11" width="14" height="10" rx="2" />
        <path d="M8 11V8a4 4 0 0 1 8 0v3" />
      </svg>
      <div style={{ fontSize: 14, lineHeight: 1.45 }}>
        <b>Privacy by design:</b> this console shows counts, plans and status only. Staff cannot see a family&apos;s
        transactions, notes, chat, voice notes or video.
      </div>
    </div>
  );
}
