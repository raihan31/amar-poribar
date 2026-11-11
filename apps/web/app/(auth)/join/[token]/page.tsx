"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { api } from "@/lib/api/client";
import { ApiProblem } from "@/lib/api/errors";
import { useT } from "@/lib/i18n/useT";
import { InviteExpiredCard } from "@/components/features/auth/ExpiredCards";
import { InvitePreview, type InvitePreviewData } from "@/components/features/family/InvitePreview";
import { Spinner } from "@/components/ui/Spinner";

const PENDING_KEY = "ap_pending_invite";
const DEAD_CODES = new Set(["invite_expired", "invite_used", "invite_revoked", "invite_not_found", "not_found"]);

type RawPreview = Omit<InvitePreviewData, "inviter"> & {
  inviter?: { id?: string; name: string };
  invitedBy?: { id?: string; name: string };
  state?: string;
};

function safeSet(fn: () => void) {
  try {
    fn();
  } catch {
    // storage can be blocked; the login redirect still carries the token in `next`
  }
}

export default function JoinPage() {
  const t = useT();
  const router = useRouter();
  const { token } = useParams<{ token: string }>();
  const [preview, setPreview] = useState<InvitePreviewData | null>(null);
  const [dead, setDead] = useState(false);
  const [signedIn, setSignedIn] = useState(false);
  const [busy, setBusy] = useState(false);
  const [joined, setJoined] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let live = true;
    (async () => {
      const [session, raw] = await Promise.all([
        api<{ authenticated: boolean }>("/api/auth/session").catch(() => ({ authenticated: false })),
        api<RawPreview>(`/v1/invites/${encodeURIComponent(token)}`),
      ]);
      if (!live) return;
      setSignedIn(session.authenticated);
      const inviter = raw.inviter ?? raw.invitedBy;
      if (raw.state && raw.state !== "valid") {
        setPreview({ ...raw, inviter });
        setDead(true);
      } else setPreview({ ...raw, inviter });
    })().catch((e) => {
      if (!live) return;
      if (e instanceof ApiProblem && DEAD_CODES.has(e.code)) setDead(true);
      else setError(t("join.error"));
    });
    return () => {
      live = false;
    };
  }, [token, t]);

  async function accept() {
    if (!signedIn) {
      safeSet(() => sessionStorage.setItem(PENDING_KEY, token));
      router.replace(`/login?next=${encodeURIComponent(`/join/${token}`)}`);
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const res = await api<{ familyId: string }>(`/v1/invites/${encodeURIComponent(token)}/accept`, {
        method: "POST",
        body: {},
      });
      document.cookie = `ap_fid=${encodeURIComponent(res.familyId)}; path=/; max-age=31536000; samesite=lax`;
      safeSet(() => sessionStorage.removeItem(PENDING_KEY));
      setJoined(true);
      router.replace("/");
    } catch (e) {
      if (e instanceof ApiProblem && DEAD_CODES.has(e.code)) setDead(true);
      else setError(t("join.error"));
      setBusy(false);
    }
  }

  return (
    <main className="auth">
      {dead ? (
        <InviteExpiredCard signedIn={signedIn} inviter={preview?.inviter} />
      ) : joined ? (
        <p role="status">{t("joined")}</p>
      ) : preview ? (
        <InvitePreview
          data={preview}
          busy={busy}
          error={error}
          onAccept={accept}
          onDecline={() => router.replace(signedIn ? "/" : "/login")}
        />
      ) : error ? (
        <p role="alert" className="error">
          {error}
        </p>
      ) : (
        <Spinner label={t("common.loading")} />
      )}
    </main>
  );
}
