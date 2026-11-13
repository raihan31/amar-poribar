"use client";

import type { TransactionListItem } from "@amar-poribar/shared";
import { Icon } from "@/components/ui/icons";
import { useFormat } from "@/lib/i18n/format";
import { useT, type TKey } from "@/lib/i18n/useT";

const SOURCE_KEY: Partial<Record<TransactionListItem["source"], TKey>> = {
  voice: "txnl.src.voice",
  sms: "txnl.src.sms",
  ai_text: "txnl.src.ai_text",
  receipt: "txnl.src.receipt",
};

/** One entry: letter tile, name, "who · account · how" meta, signed amount, lock for private rows. */
export function TransactionRow({ item }: { item: TransactionListItem }) {
  const t = useT();
  const { money, name } = useFormat();
  const title =
    item.note?.trim() ||
    item.counterparty?.trim() ||
    (item.categoryNameBn
      ? name({ nameBn: item.categoryNameBn, nameEn: item.categoryNameEn ?? item.categoryNameBn })
      : "");
  const srcKey = SOURCE_KEY[item.source];
  const meta = [item.paidByName, item.accountName, srcKey ? t(srcKey) : null].filter(Boolean).join(" · ");
  const sign = item.type === "expense" ? "−" : item.type === "income" ? "+" : "";
  return (
    <li className="txn-row">
      <span className="txn-row__tile" aria-hidden="true">
        {Array.from(title)[0] ?? ""}
      </span>
      <span className="txn-row__body">
        <strong data-testid="txn-name">{title}</strong>
        {meta && <span className="txn-row__meta">{meta}</span>}
        {item.isPrivate && (
          <span className="txn-row__private">
            <Icon name="lock" size={16} /> {t("txnl.private")}
          </span>
        )}
      </span>
      <span className={`txn-row__amt txn-row__amt--${item.type}`}>
        {sign}
        {money(item.amountPaisa)}
      </span>
    </li>
  );
}
