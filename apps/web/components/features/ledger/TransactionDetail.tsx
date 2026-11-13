"use client";

import "@/styles/ledger.css";
import Link from "next/link";
import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { amountInWords } from "@amar-poribar/shared";
import { Banner } from "@/components/ui/Banner";
import { Button } from "@/components/ui/Button";
import { Dialog } from "@/components/ui/Dialog";
import { api } from "@/lib/api/client";
import { ApiProblem } from "@/lib/api/errors";
import { isDeletedProblem, useTransaction } from "@/lib/api/hooks/useTransaction";
import { qk } from "@/lib/api/queryKeys";
import { useFormat } from "@/lib/i18n/format";
import { useI18n } from "@/lib/i18n/provider";
import { useT, type TKey } from "@/lib/i18n/useT";
import { UndoBanner } from "./UndoBanner";

const SOURCE_KEY: Record<string, TKey> = {
  voice: "txn.src.voice",
  ai_text: "txn.src.voice",
  sms: "txn.src.sms",
  receipt: "txn.src.receipt",
  manual: "txn.src.manual",
};

const dhakaDay = (d: Date) => new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Dhaka" }).format(d);

/** D5: one entry, who can change it, delete with undo (FR-TXN-03, -10; AC-07, AC-14). */
export function TransactionDetail({ familyId, txnId }: { familyId: string; txnId: string }) {
  const t = useT();
  const { locale } = useI18n();
  const fmt = useFormat();
  const qc = useQueryClient();
  const q = useTransaction(familyId, txnId);
  const [confirm, setConfirm] = useState(false);
  const [deletedNow, setDeletedNow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  const [forbidden, setForbidden] = useState(false);

  const base = `/v1/families/${familyId}/transactions/${txnId}`;
  const deleted = deletedNow || isDeletedProblem(q.error);

  async function refresh() {
    await Promise.all([
      qc.invalidateQueries({ queryKey: ["family", familyId, "transactions"] }),
      qc.invalidateQueries({ queryKey: qk.family(familyId).summary() }),
    ]);
  }

  async function remove() {
    setConfirm(false);
    setFailed(false);
    setBusy(true);
    try {
      await api(base, { method: "DELETE" });
      setDeletedNow(true);
      await refresh();
    } catch (e) {
      if (e instanceof ApiProblem && e.status === 403) setForbidden(true);
      else setFailed(true);
    } finally {
      setBusy(false);
    }
  }

  async function restore() {
    setFailed(false);
    setBusy(true);
    try {
      await api(`${base}/restore`, { method: "POST" });
      setDeletedNow(false);
      await refresh();
    } catch {
      setFailed(true);
    } finally {
      setBusy(false);
    }
  }

  if (deleted) {
    return (
      <main className="ledger-page">
        <UndoBanner busy={busy} failed={failed} onRestore={restore} />
      </main>
    );
  }
  if (q.isPending) return <main className="ledger-page" aria-busy="true" />;
  if (q.isError || !q.data) {
    return (
      <main className="ledger-page">
        <Banner tone="danger">{t("txn.loadFailed")}</Banner>
      </main>
    );
  }

  const x = q.data;
  const sign = x.type === "income" ? "+" : x.type === "expense" ? "−" : "";
  const day = x.dayKey === dhakaDay(new Date()) ? t("entry.today") : fmt.date(x.occurredAt, "short");
  const rows: Array<[string, string]> = [
    [t("txn.account"), x.accountName ?? "—"],
    [t("txn.paidBy"), x.paidByName ?? "—"],
    [t("txn.how"), t(SOURCE_KEY[x.source] ?? "txn.src.manual")],
    [t("txn.trx"), x.trxId ?? t("txn.trxNone")],
    [t("txn.note"), x.note ?? "—"],
    [t("txn.who"), x.isPrivate ? t("txn.whoPrivate") : t("txn.whoAll")],
  ];
  const locked = !x.canEdit || forbidden;

  return (
    <main className="ledger-page txn-detail">
      <section className="txn-card">
        <p className="txn-card__cat">
          {(locale === "bn" ? x.categoryNameBn : x.categoryNameEn) ?? "—"} · {day}, {fmt.date(x.occurredAt, "time")}
        </p>
        <p className="txn-card__amount" style={{ fontSize: 40, fontWeight: 700, margin: 0 }}>
          {sign}
          {fmt.money(x.amountPaisa)}
        </p>
        <p className="muted">{amountInWords(x.amountPaisa, locale)}</p>
        <dl className="txn-rows">
          {rows.map(([k, v]) => (
            <div key={k} className="txn-row">
              <dt>{k}</dt>
              <dd>{v}</dd>
            </div>
          ))}
        </dl>
        {x.attachmentUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img className="txn-receipt" src={x.attachmentUrl} alt={t("txn.receipt")} width={96} height={96} />
        )}
      </section>

      {failed && <Banner tone="danger">{t("txn.failed")}</Banner>}
      <div className="ledger-actions">
        {locked ? (
          <Button size="lg" variant="secondary" disabled>
            {t("txn.edit")}
          </Button>
        ) : (
          <Link className="ui-btn ui-btn--secondary" style={{ minHeight: 56 }} href={`/add?edit=${txnId}`}>
            {t("txn.edit")}
          </Link>
        )}
        <Button size="lg" variant="danger" disabled={locked || busy} onClick={() => setConfirm(true)}>
          {t("txn.delete")}
        </Button>
      </div>
      {locked && <p className="muted">{t("txn.ownOnly")}</p>}

      <Dialog
        open={confirm}
        onClose={() => setConfirm(false)}
        title={t("txn.confirmTitle")}
        closeLabel={t("txn.closeDialog")}
      >
        <div className="ledger-actions">
          <Button size="lg" variant="secondary" onClick={() => setConfirm(false)}>
            {t("txn.confirmNo")}
          </Button>
          <Button size="lg" variant="danger" onClick={remove}>
            {t("txn.confirmYes")}
          </Button>
        </div>
      </Dialog>
    </main>
  );
}
