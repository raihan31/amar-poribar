import { StatusPill, type PillKind } from "@/components/ui/StatusPill";
import type { PrivacyStep, StepState } from "./types";

const PILL: Record<StepState, { kind: PillKind; text: string }> = {
  done: { kind: "ok", text: "Done" },
  waiting: { kind: "warn", text: "Waiting" },
  todo: { kind: "neutral", text: "To do" },
};

function fmt(iso: string): string {
  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Asia/Dhaka",
  }).format(new Date(iso));
}

export function StepList({ steps }: { steps: PrivacyStep[] }) {
  return (
    <ol className="step-list" style={{ listStyle: "none", padding: 0, margin: 0 }}>
      {steps.map((s) => {
        const p = PILL[s.state];
        return (
          <li key={s.key} className="row" style={{ gap: 12, padding: "8px 0" }}>
            <StatusPill kind={p.kind}>{p.text}</StatusPill>
            <span>
              {s.label}
              {s.auto && s.state !== "done" && (
                <span className="muted" style={{ display: "block" }}>
                  {s.nextRunAt ? `Runs automatically — next run ${fmt(s.nextRunAt)}` : "Runs automatically"}
                </span>
              )}
            </span>
          </li>
        );
      })}
    </ol>
  );
}
