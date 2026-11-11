"use client";

import { useRouter } from "next/navigation";
import { useT } from "@/lib/i18n/useT";
import { Button } from "../../ui/Button";
import { Card } from "../../ui/Card";
import { Icon } from "../../ui/icons";

/** F6, second card: the invite link no longer works. The buzz button needs a signed-in user and a known inviter. */
export function InviteExpiredCard({
  signedIn,
  inviter,
}: {
  signedIn: boolean;
  inviter?: { id?: string; name: string } | null;
}) {
  const t = useT();
  const router = useRouter();
  return (
    <Card role="alert" className="expired-card">
      <h1 style={{ fontSize: 24, margin: "0 0 8px" }}>{t("exp.inviteTitle")}</h1>
      <p>{t("exp.inviteBody")}</p>
      {signedIn && inviter?.id && (
        <Button variant="buzz" size="xl" onClick={() => router.push(`/buzz?to=${encodeURIComponent(inviter.id!)}`)}>
          <Icon name="buzz" /> {t("exp.buzz", { name: inviter.name })}
        </Button>
      )}
    </Card>
  );
}

/** F6, first card: refresh failed, sign in again and come back to `next`. */
export function SessionExpiredCard({ next }: { next: string }) {
  const t = useT();
  const router = useRouter();
  return (
    <Card role="alert" className="expired-card">
      <h1 style={{ fontSize: 24, margin: "0 0 8px" }}>{t("exp.sessionTitle")}</h1>
      <p>{t("exp.sessionBody")}</p>
      <Button size="xl" onClick={() => router.replace(`/login?next=${encodeURIComponent(next)}`)}>
        {t("exp.login")}
      </Button>
    </Card>
  );
}
