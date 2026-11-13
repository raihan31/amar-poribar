import { Card } from "@/components/ui/Card";

export function QuotaRuleCard() {
  return (
    <Card title="When quota runs out">
      <p style={{ margin: 0 }}>
        Members fall back to manual entry. The SMS parser and the offline quick parser still work with no AI. Monthly
        summary switches to the fixed template.
      </p>
    </Card>
  );
}
