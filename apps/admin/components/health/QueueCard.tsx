import { Card } from "@/components/ui/Card";

export function QueueCard({ depth, deadLetters }: { depth: number; deadLetters: number }) {
  return (
    <Card title="Job queue">
      <div style={{ padding: "6px 0" }}>Queue depth: {depth}</div>
      <div data-testid="dead-letters" style={deadLetters > 0 ? { color: "#9a2a00", fontWeight: 600 } : undefined}>
        {deadLetters > 0 ? `⚠ ${deadLetters} need attention` : "Dead letters: 0 ✓"}
      </div>
    </Card>
  );
}
