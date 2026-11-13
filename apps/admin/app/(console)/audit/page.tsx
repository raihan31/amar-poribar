"use client";

import { Suspense, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useRouter, useSearchParams } from "next/navigation";
import { PageTitle } from "@/components/shell/PageTitle";
import { AuditFilters, readFilters } from "@/components/audit/AuditFilters";
import { AuditTable } from "@/components/audit/AuditTable";
import { ChainStatus } from "@/components/audit/ChainStatus";
import { Button } from "@/components/ui/Button";
import { api } from "@/lib/api/client";
import { qk } from "@/lib/api/queryKeys";
import { toQuery, VERIFY_IN_OPENAPI, type AuditList, type ChainMeta } from "@/lib/audit/types";

const LIMIT = 50;

const verifyChain = () => api<ChainMeta>("/admin/v1/audit/verify");

function AuditView() {
  const sp = useSearchParams();
  const router = useRouter();
  const filters = readFilters(sp);
  const cursor = sp.get("cursor") ?? "";
  const page = Number(sp.get("page") ?? "1") || 1;
  const [now] = useState(() => new Date());
  const q = toQuery(filters, now);
  const exportHref = `/api/proxy/admin/v1/audit/export.csv?${q.toString()}`;
  if (cursor) q.set("cursor", cursor);
  q.set("limit", String(LIMIT));

  const { data, isLoading } = useQuery({
    queryKey: qk.audit({ ...filters, cursor, page }),
    queryFn: () => api<AuditList>(`/admin/v1/audit?${q.toString()}`),
  });
  const items = data?.items ?? [];
  const total = data?.total ?? 0;
  const first = items.length ? (page - 1) * LIMIT + 1 : 0;
  const last = (page - 1) * LIMIT + items.length;

  function next() {
    const p = new URLSearchParams(sp.toString());
    p.set("cursor", data?.nextCursor ?? "");
    p.set("page", String(page + 1));
    router.push(`/audit?${p.toString()}`);
  }

  return (
    <div>
      <PageTitle
        title="Audit log"
        subtitle="Entries cannot be edited or deleted by anyone, including the owner. They are kept for 2 years."
        actions={
          <>
            {data && <ChainStatus chain={data.chain} onVerify={VERIFY_IN_OPENAPI ? verifyChain : undefined} />}
            <a className="btn" href={exportHref}>
              Export (CSV)
            </a>
          </>
        }
      />
      <AuditFilters staffNames={[...new Set(items.map((i) => i.staffName))]} />
      <AuditTable items={items} loading={isLoading} />
      <footer className="row">
        <span>
          Showing {first}–{last} of {total} · times in Asia/Dhaka
        </span>
        <Button disabled={page <= 1} onClick={() => router.back()}>
          Previous
        </Button>
        <Button disabled={!data?.nextCursor} onClick={next}>
          Next
        </Button>
      </footer>
    </div>
  );
}

export default function AuditPage() {
  return (
    <Suspense>
      <AuditView />
    </Suspense>
  );
}
