"use client";

import type { TransactionDraft } from "@amar-poribar/shared";
import { Banner } from "@/components/ui/Banner";
import { Icon } from "@/components/ui/icons";
import { dayWord } from "@/lib/entry/quickParse";
import { useFormat } from "@/lib/i18n/format";
import { useT, type TKey } from "@/lib/i18n/useT";
import type { Category } from "@/lib/types";
import { cx } from "@/components/ui/cx";

const PROVIDER_KEY: Record<string, TKey> = {
  bkash: "entry.acct.bkash",
  nagad: "entry.acct.nagad",
  rocket: "entry.acct.rocket",
  upay: "entry.acct.upay",
};

/** "01712345789" becomes "01XXXXX-789"; anything too short to mask is returned as is. */
export function maskRecipient(raw: string): string {
  const digits = raw.replace(/\D/g, "");
  if (digits.length < 5) return raw;
  return `${digits.slice(0, 2)}XXXXX-${digits.slice(-3)}`;
}

export interface SmsPreviewProps {
  draft: TransactionDraft;
  via: string;
  duplicate: boolean;
  /** Up to three suggested categories, then "other" is always offered. */
  suggestions: Category[];
  /** Selected category key, or "other" for the catch-all. */
  picked: string | null;
  onPick: (key: string) => void;
}

/** A5 preview of the parsed SMS: recognition line, card, duplicate banner or category prompt. */
export function SmsPreview({ draft, via, duplicate, suggestions, picked, onPick }: SmsPreviewProps) {
  const t = useT();
  const { money, date, name, num } = useFormat();
  const providerKey = draft.accountType ? PROVIDER_KEY[draft.accountType] : undefined;
  const provider = providerKey ? t(providerKey) : (draft.accountType ?? "");
  const day = dayWord(draft.occurredAt);
  const when = [
    day ? t(day === "today" ? "entry.today" : "entry.yesterday") : date(draft.occurredAt),
    date(draft.occurredAt, "time"),
  ].join(", ");
  const toBn = (s: string) => s.replace(/\d/g, (d) => num(Number(d)));
  const masked = draft.counterparty ? toBn(maskRecipient(draft.counterparty)) : null;
  const template = via === "template" && providerKey;

  return (
    <div className="sms-preview">
      <p className="sms-via">
        <Icon name="check" size={22} />
        {template ? t("sms.recognized", { provider }) : t("sms.byAi")}
      </p>

      <section className="sms-card" aria-label={draft.type === "income" ? t("sms.received") : t("sms.sent")}>
        <div className="sms-card-title">{draft.type === "income" ? t("sms.received") : t("sms.sent")}</div>
        <div className="sms-amount">{money(draft.amountPaisa)}</div>
        <dl className="sms-grid">
          {masked && (
            <>
              <dt>{draft.type === "income" ? t("sms.from") : t("sms.to")}</dt>
              <dd>{masked}</dd>
            </>
          )}
          <dt>{t("sms.fee")}</dt>
          <dd>{money(draft.feePaisa)}</dd>
          {provider && (
            <>
              <dt>{t("sms.account")}</dt>
              <dd>{provider}</dd>
            </>
          )}
          <dt>{t("sms.time")}</dt>
          <dd>{when}</dd>
          {draft.trxId && (
            <>
              <dt>{t("sms.trx")}</dt>
              <dd>{draft.trxId}</dd>
            </>
          )}
        </dl>
      </section>

      {duplicate ? (
        <Banner tone="warn">{t("sms.duplicate")}</Banner>
      ) : (
        <>
          <Banner tone="warn">{t("sms.new")}</Banner>
          <div className="sms-cats">
            {suggestions.map((c) => (
              <button
                key={c.key}
                type="button"
                className={cx("sms-cat", picked === c.key && "sms-cat--on")}
                aria-pressed={picked === c.key}
                onClick={() => onPick(c.key)}
              >
                {picked === c.key ? "✓ " : ""}
                {name(c)}
              </button>
            ))}
            <button
              type="button"
              className={cx("sms-cat", picked === "other" && "sms-cat--on")}
              aria-pressed={picked === "other"}
              onClick={() => onPick("other")}
            >
              {picked === "other" ? "✓ " : ""}
              {t("sms.other")}
            </button>
          </div>
        </>
      )}
    </div>
  );
}
