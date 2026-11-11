import { Card } from "@/components/ui/Card";

const HIDDEN = { position: "absolute", width: 1, height: 1, overflow: "hidden", clip: "rect(0 0 0 0)" } as const;

export function NewFamiliesChart({ weeks }: { weeks: { weekStart: string; count: number }[] }) {
  const max = Math.max(1, ...weeks.map((w) => w.count));
  const last = weeks[weeks.length - 1];
  return (
    <Card title="New families per week">
      <div
        aria-hidden="true"
        style={{
          display: "flex",
          alignItems: "flex-end",
          gap: 10,
          height: 150,
          borderBottom: "1px solid var(--border)",
          padding: "0 4px",
        }}
      >
        {weeks.map((w, i) => (
          <div
            key={w.weekStart}
            data-testid="bar"
            style={{
              flex: 1,
              height: `${Math.round((w.count * 100) / max)}%`,
              background: i === weeks.length - 1 ? "var(--green-700)" : "#7db383",
              borderRadius: "6px 6px 0 0",
            }}
          />
        ))}
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, marginTop: 6 }} className="muted">
        <span>{weeks[0]?.weekStart}</span>
        <span>This week: {last?.count ?? 0} new</span>
      </div>
      <table style={HIDDEN}>
        <caption>New families per week</caption>
        <thead>
          <tr>
            <th scope="col">Week starting</th>
            <th scope="col">New families</th>
          </tr>
        </thead>
        <tbody>
          {weeks.map((w) => (
            <tr key={w.weekStart}>
              <td>{w.weekStart}</td>
              <td>{w.count}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </Card>
  );
}
