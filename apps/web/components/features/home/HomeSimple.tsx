"use client";

import Link from "next/link";
import { useI18n } from "@/lib/i18n/provider";
import { useT } from "@/lib/i18n/useT";
import { useSpeak } from "@/lib/speech/useSpeak";
import { Icon } from "@/components/ui/icons";

/** D3: one huge mic and four picture tiles (FR-HOME-01, FR-VOICE-09). */
export function HomeSimple({
  familyName,
  speechText,
  canWrite,
}: {
  familyName: string;
  speechText?: string;
  canWrite: boolean;
}) {
  const t = useT();
  const { setPreference } = useI18n();
  const { speak } = useSpeak();
  return (
    <div className="home-simple">
      <header className="home-simple-head">
        <h1 className="home-simple-title">{familyName}</h1>
        <span className="home-simple-badge">
          <Icon name="speaker" size={20} />
          {t("home.simple.readsAll")}
        </span>
      </header>
      {canWrite ? (
        <>
          <Link href="/add/voice?autostart=1" className="home-simple-mic">
            <Icon name="mic" size={84} />
            {t("home.simple.say")}
          </Link>
          <p className="home-simple-hint">{t("home.simple.hint")}</p>
        </>
      ) : (
        <p className="home-simple-hint">{t("role.readOnly")}</p>
      )}
      <div className="home-simple-tiles">
        <Link href="/buzz" className="home-simple-tile home-simple-tile--amber">
          <Icon name="buzz" size={48} />
          {t("home.tileBuzz")}
        </Link>
        <Link href="/chat" className="home-simple-tile">
          <Icon name="chat" size={48} />
          {t("home.tileChat")}
        </Link>
        <button
          type="button"
          className="home-simple-tile"
          onClick={() => speechText && speak(speechText, { interrupt: true })}
        >
          <Icon name="speaker" size={48} />
          {t("home.simple.month")}
        </button>
        <Link href="/txns" className="home-simple-tile">
          <Icon name="list" size={48} />
          {t("home.simple.expenses")}
        </Link>
      </div>
      <button type="button" className="home-simple-exit" onClick={() => setPreference({ simple: false })}>
        {t("home.simple.normal")}
      </button>
    </div>
  );
}
