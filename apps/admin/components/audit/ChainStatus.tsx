"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { StatusPill } from "@/components/ui/StatusPill";
import type { ChainMeta } from "@/lib/audit/types";

export interface ChainStatusProps {
  chain: ChainMeta;
  /** Present only when the verify route exists; resolves to the fresh chain state. */
  onVerify?: () => Promise<ChainMeta>;
}

export function ChainStatus({ chain, onVerify }: ChainStatusProps) {
  const [fresh, setFresh] = useState<ChainMeta | null>(null);
  const [busy, setBusy] = useState(false);
  const c = fresh ?? chain;

  async function verify() {
    if (!onVerify) return;
    setBusy(true);
    try {
      setFresh(await onVerify());
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="row" data-testid="chain-status">
      {c.ok ? (
        <StatusPill kind="ok">Chain verified through #{c.verifiedThrough}</StatusPill>
      ) : (
        <span role="alert">
          <StatusPill kind="risk">Chain broken at #{c.brokenAt}</StatusPill>
        </span>
      )}
      {onVerify && (
        <Button onClick={verify} disabled={busy}>
          Verify now
        </Button>
      )}
    </div>
  );
}
