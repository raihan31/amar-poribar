"use client";

import Link from "next/link";
import { useFormat } from "@/lib/i18n/format";
import { useT } from "@/lib/i18n/useT";
import type { ActivityItem } from "@/lib/home/useHomeData";
import { Icon } from "@/components/ui/icons";

function duration(sec: number, num: (n: number) => string): string {
  return `${num(Math.floor(sec / 60))}:${num(sec % 60).padStart(2, num(0))}`;
}

/** The two latest family items: voice notes (play) and expenses (amount); tap opens chat or the entry. */
export function ActivityFeed({ items }: { items: ActivityItem[] }) {
  const t = useT();
  const { money, num } = useFormat();
  if (items.length === 0) return null;
  return (
    <ul className="home-activity" aria-label={t("home.activity")}>
      {items.slice(0, 2).map((it) => (
        <li key={it.id} className="home-activity-item">
          {it.kind === "voice_note" ? (
            <>
              <Link href="/chat" className="home-activity-text">
                {t("home.voiceFrom", { name: it.byName, time: duration(it.durationSec ?? 0, num) })}
              </Link>
              <button
                type="button"
                className="home-activity-play"
                aria-label={t("home.listen")}
                onClick={() => it.audioUrl && void new Audio(it.audioUrl).play()}
              >
                <Icon name="play" size={22} />
              </button>
            </>
          ) : (
            <>
              <Link href={it.txnId ? `/txn/${it.txnId}` : "/chat"} className="home-activity-text">
                {t("home.wrote", { name: it.byName, text: it.text ?? "" })}
              </Link>
              {it.amountPaisa !== undefined && <span className="home-activity-amount">−{money(it.amountPaisa)}</span>}
            </>
          )}
        </li>
      ))}
    </ul>
  );
}
