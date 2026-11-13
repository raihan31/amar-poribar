"use client";

import { Fragment } from "react";
import { spendingRose, splitAmounts, splitSentences } from "@/lib/format/amounts";
import { useT } from "@/lib/i18n/useT";
import { cx } from "@/components/ui/cx";

/** B2 card: sentences at 22 px, amounts bold, the rise in danger colour, the tip in a green block (FR-AI-11). */
export function SummaryCard({ text }: { text: string }) {
  const t = useT();
  const tipPrefix = t("sum.tipPrefix");
  const sentences = splitSentences(text);
  const totalAt = sentences.findIndex(
    (s) => !s.startsWith(tipPrefix) && splitAmounts(s).some((p) => p.kind === "amount"),
  );

  return (
    <div className="sum-card">
      {sentences.map((s, i) => {
        if (s.startsWith(tipPrefix)) {
          return (
            <p key={i} className="sum-tip">
              {s}
            </p>
          );
        }
        const rose = spendingRose(s);
        const parts = splitAmounts(s);
        const firstAmount = parts.findIndex((p) => p.kind === "amount");
        return (
          <p key={i} className="sum-line">
            {parts.map((part, j) => {
              if (part.kind === "text") return <Fragment key={j}>{part.value}</Fragment>;
              const isTotal = i === totalAt && j === firstAmount;
              return (
                <b key={j} className={cx(rose && "sum-amount--up", isTotal && !rose && "sum-amount--total")}>
                  {part.value}
                </b>
              );
            })}
          </p>
        );
      })}
    </div>
  );
}
