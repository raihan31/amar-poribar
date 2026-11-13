"use client";

import { useParams } from "next/navigation";
import { TransactionDetail } from "@/components/features/ledger/TransactionDetail";
import { BackHeader } from "@/components/shell/BackHeader";
import { useFamily } from "@/components/shell/useFamily";
import { useT } from "@/lib/i18n/useT";

/** D5 transaction detail with undo. */
export default function TransactionDetailPage() {
  const t = useT();
  const { id } = useParams<{ id: string }>();
  const { family } = useFamily();
  return (
    <>
      <BackHeader title={t("txn.title")} />
      <TransactionDetail familyId={family.id} txnId={id} />
    </>
  );
}
