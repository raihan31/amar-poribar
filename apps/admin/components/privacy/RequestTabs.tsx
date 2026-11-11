import type { PrivacyList, PrivacyStatus } from "./types";

const TABS: { key: PrivacyStatus; label: string }[] = [
  { key: "open", label: "Open" },
  { key: "done", label: "Done" },
  { key: "rejected", label: "Rejected" },
];

export function RequestTabs({
  value,
  counts,
  onChange,
}: {
  value: PrivacyStatus;
  counts?: PrivacyList["counts"];
  onChange: (s: PrivacyStatus) => void;
}) {
  return (
    <div className="tabs" role="group" aria-label="Request status">
      {TABS.map((t) => (
        <button key={t.key} type="button" aria-pressed={value === t.key} onClick={() => onChange(t.key)}>
          {t.label} · {counts?.[t.key] ?? 0}
        </button>
      ))}
    </div>
  );
}
