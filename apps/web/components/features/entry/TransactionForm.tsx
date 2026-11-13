"use client";

import { useEffect, useId, useState } from "react";
import { useForm, type FieldErrors, type Resolver } from "react-hook-form";
import { useQueryClient } from "@tanstack/react-query";
import { parseAmountToPaisa } from "@amar-poribar/shared";
import { AmountInput } from "@/components/ui/AmountInput";
import { Banner } from "@/components/ui/Banner";
import { Chip } from "@/components/ui/Chip";
import { api } from "@/lib/api/client";
import { ApiProblem } from "@/lib/api/errors";
import { qk } from "@/lib/api/queryKeys";
import { flushOutbox, enqueue } from "@/lib/entry/outbox";
import {
  toCreateBody,
  transactionFormSchema,
  type TransactionFormParsed,
  type TransactionFormValues,
} from "@/lib/entry/transactionSchema";
import { useI18n } from "@/lib/i18n/provider";
import { useT, type TKey } from "@/lib/i18n/useT";
import type { Account, Category, Member } from "@/lib/types";
import { AccountChips } from "./AccountChips";
import { CategoryRow } from "./CategoryRow";
import { PrivateToggle } from "./PrivateToggle";
import { TypeSegment } from "./TypeSegment";

const resolver: Resolver<TransactionFormValues, unknown, TransactionFormParsed> = async (values) => {
  const r = transactionFormSchema.safeParse(values);
  if (r.success) return { values: r.data, errors: {} };
  const errors: Record<string, { type: string; message: string }> = {};
  for (const issue of r.error.issues) {
    const key = String(issue.path[0] ?? "root");
    errors[key] ??= { type: issue.code, message: issue.message };
  }
  return { values: {}, errors: errors as FieldErrors<TransactionFormValues> };
};

export interface TransactionFormProps {
  familyId: string;
  /** The signed-in user; entries are recorded for them unless an admin picks someone else. */
  meId?: string;
  /** Only admins may record an entry on behalf of another member. */
  canPickMember: boolean;
  categories: Category[];
  accounts: Account[];
  members: Member[];
  defaults?: Partial<TransactionFormValues>;
  /** Called after the entry reached the server (not when it only went to the outbox). */
  onSaved?: () => void;
}

/** D4: typed entry. Online it posts with a client id; offline it waits in the outbox (FR-TXN-01, -05, -09). */
export function TransactionForm(props: TransactionFormProps) {
  const { familyId, meId, canPickMember, categories, accounts, members, defaults, onSaved } = props;
  const t = useT();
  const { locale } = useI18n();
  const qc = useQueryClient();
  const whoId = useId();
  const dateId = useId();
  const noteId = useId();
  const [feeOpen, setFeeOpen] = useState(false);
  const [queued, setQueued] = useState(false);
  const [failed, setFailed] = useState(false);
  const [sending, setSending] = useState(false);

  const form = useForm<TransactionFormValues, unknown, TransactionFormParsed>({
    resolver,
    defaultValues: {
      type: "expense",
      amount: "",
      categoryId: null,
      accountId: accounts[0]?.id ?? null,
      paidByUserId: meId,
      day: "today",
      date: "",
      note: "",
      fee: "",
      isPrivate: false,
      ...defaults,
    },
  });
  const { watch, setValue, register, handleSubmit, formState } = form;
  const v = watch();
  const errors = formState.errors;
  const incoming = v.type === "income";
  const transfer = v.type === "transfer";
  const kind = incoming ? "income" : "expense";
  const kindCategories = categories.filter((c) => !c.isHidden && c.kind === kind);
  const paisa = parseAmountToPaisa(v.amount) ?? 0;
  const err = (key: keyof TransactionFormValues) => {
    const m = errors[key]?.message;
    return m ? t(m as TKey) : null;
  };

  const refresh = () =>
    Promise.all([
      qc.invalidateQueries({ queryKey: ["family", familyId, "transactions"] }),
      qc.invalidateQueries({ queryKey: qk.family(familyId).summary() }),
    ]);

  // Deliver queued entries when the connection returns, and once on open if we are online.
  useEffect(() => {
    const run = () => void flushOutbox(familyId).then((n) => (n > 0 ? refresh() : undefined));
    if (typeof navigator === "undefined" || navigator.onLine) run();
    window.addEventListener("online", run);
    return () => window.removeEventListener("online", run);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [familyId]);

  function clear() {
    setValue("amount", "");
    setValue("note", "");
    setValue("fee", "");
    setFeeOpen(false);
  }

  const submit = handleSubmit(async (parsed) => {
    setFailed(false);
    setQueued(false);
    const body = toCreateBody(parsed, crypto.randomUUID(), meId);
    const queue = async () => {
      await enqueue({ id: body.id, familyId, body, queuedAt: new Date().toISOString() });
      setQueued(true);
      clear();
    };
    if (typeof navigator !== "undefined" && !navigator.onLine) return queue();
    setSending(true);
    try {
      await api(`/v1/families/${familyId}/transactions`, { body, idempotencyKey: body.id });
      await refresh();
      clear();
      onSaved?.();
    } catch (e) {
      // A server answer is final; no answer at all means the network is down, so keep it for later.
      if (e instanceof ApiProblem) setFailed(true);
      else await queue();
    } finally {
      setSending(false);
    }
  });

  return (
    <form className="entry entry-form" onSubmit={submit} noValidate aria-label={t("entry.form.title")}>
      {queued && (
        <div className="entry-toast" role="status">
          {t("entry.form.queued")}
        </div>
      )}
      {failed && <Banner tone="danger">{t("entry.saveFailed")}</Banner>}

      <TypeSegment value={v.type} onChange={(x) => setValue("type", x)} />

      <AmountInput
        label={t("entry.form.amount")}
        valuePaisa={paisa}
        lang={locale}
        onChange={(p) =>
          setValue("amount", p ? String(Math.floor(p / 100)) : "", { shouldValidate: formState.isSubmitted })
        }
      />
      <p className="entry-hint">{err("amount") ?? t("entry.form.amountHint")}</p>

      {!transfer && (
        <section>
          <h2 className="entry-whatfor">{t("entry.whatFor")}</h2>
          <CategoryRow
            categories={kindCategories}
            selectedId={v.categoryId}
            onSelect={(id) => setValue("categoryId", id)}
          />
        </section>
      )}

      <section>
        <h2 className="entry-whatfor">{incoming || transfer ? t("entry.form.acctTo") : t("entry.form.acctFrom")}</h2>
        <AccountChips
          accounts={accounts}
          value={v.accountId}
          onChange={(id) => setValue("accountId", id)}
          label={incoming || transfer ? t("entry.form.acctTo") : t("entry.form.acctFrom")}
        />
      </section>

      <div className="ui-field">
        <label htmlFor={whoId}>{incoming ? t("entry.form.whoGot") : t("entry.form.whoPaid")}</label>
        <select id={whoId} {...register("paidByUserId")} disabled={!canPickMember}>
          {members.map((m) => (
            <option key={m.userId} value={m.userId}>
              {m.name ?? m.phone}
            </option>
          ))}
        </select>
      </div>

      <section>
        <h2 className="entry-whatfor">{t("entry.form.when")}</h2>
        <div className="entry-chips" role="group" aria-label={t("entry.form.when")}>
          <Chip selected={v.day === "today"} onClick={() => setValue("day", "today")}>
            {t("entry.today")}
          </Chip>
          <Chip selected={v.day === "yesterday"} onClick={() => setValue("day", "yesterday")}>
            {t("entry.yesterday")}
          </Chip>
          <Chip selected={v.day === "other"} onClick={() => setValue("day", "other")}>
            {t("entry.form.otherDay")}
          </Chip>
        </div>
        {v.day === "other" && (
          <div className="ui-field">
            <label htmlFor={dateId} className="entry-hint">
              {t("entry.form.otherDay")}
            </label>
            <input id={dateId} type="date" {...register("date")} />
            {err("date") && <span role="alert">{err("date")}</span>}
          </div>
        )}
      </section>

      <div className="ui-field">
        <label htmlFor={noteId}>{t("entry.form.note")}</label>
        <input id={noteId} type="text" maxLength={500} placeholder={t("entry.form.notePh")} {...register("note")} />
      </div>

      {feeOpen ? (
        <div className="ui-field">
          <label htmlFor={`${noteId}-fee`}>{t("entry.form.fee")}</label>
          <input id={`${noteId}-fee`} type="text" inputMode="numeric" autoComplete="off" {...register("fee")} />
          {err("fee") && <span role="alert">{err("fee")}</span>}
        </div>
      ) : (
        <p className="entry-hint">
          {t("entry.form.feeAsk")}{" "}
          <button type="button" className="entry-link" onClick={() => setFeeOpen(true)}>
            {t("entry.form.feeAdd")}
          </button>
        </p>
      )}

      <PrivateToggle checked={v.isPrivate} onChange={(x) => setValue("isPrivate", x)} />

      <div className="entry-sticky">
        <button type="submit" className="entry-save" disabled={sending}>
          {t("entry.form.keep")}
        </button>
      </div>
    </form>
  );
}
