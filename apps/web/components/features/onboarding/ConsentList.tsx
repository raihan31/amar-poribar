"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Icon, type IconName } from "@/components/ui/icons";
import { useT } from "@/lib/i18n/useT";
import { PolicyDialog } from "./PolicyDialog";

const ROWS: Array<{ icon: IconName; key: "onb.use1" | "onb.use2" | "onb.use3" }> = [
  { icon: "family", key: "onb.use1" },
  { icon: "mic", key: "onb.use2" },
  { icon: "lock", key: "onb.use3" },
];

export interface ConsentListProps {
  onSubmit: (familyName: string) => void;
  busy?: boolean;
  error?: string | null;
}

/** A2 body: family name, currency, the three data-use rows, the consent checkbox and the submit button. */
export function ConsentList({ onSubmit, busy = false, error }: ConsentListProps) {
  const t = useT();
  const [name, setName] = useState("");
  const [agreed, setAgreed] = useState(false);
  const [policyOpen, setPolicyOpen] = useState(false);
  const ready = agreed && name.trim().length > 0 && !busy;

  return (
    <form
      className="onb__form"
      onSubmit={(e) => {
        e.preventDefault();
        if (ready) onSubmit(name.trim());
      }}
    >
      <label className="onb__label" htmlFor="family-name">
        {t("onb.familyName")}
      </label>
      <input
        id="family-name"
        className="onb__name"
        value={name}
        placeholder={t("onb.namePlaceholder")}
        onChange={(e) => setName(e.target.value)}
      />
      <h2 className="onb__label">{t("onb.currency")}</h2>
      <div className="onb__currency">{t("onb.currencyValue")}</div>
      <h2 className="onb__label">{t("onb.dataUse")}</h2>
      <Card>
        <ul className="onb__rows">
          {ROWS.map((r) => (
            <li key={r.key}>
              <Icon name={r.icon} size={28} />
              <span>{t(r.key)}</span>
            </li>
          ))}
        </ul>
      </Card>
      <div className="onb__agree">
        <label>
          <input type="checkbox" checked={agreed} onChange={(e) => setAgreed(e.target.checked)} />
          <span>{t("onb.agree")}</span>
        </label>
        <button type="button" className="onb__link" onClick={() => setPolicyOpen(true)}>
          {t("onb.policy")}
        </button>
      </div>
      {error && <p role="alert">{error}</p>}
      <Button type="submit" size="xl" disabled={!ready}>
        {t("onb.createFamily")}
      </Button>
      <PolicyDialog open={policyOpen} onClose={() => setPolicyOpen(false)} />
    </form>
  );
}
