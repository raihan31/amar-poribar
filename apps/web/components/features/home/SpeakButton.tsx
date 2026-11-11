"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useT } from "@/lib/i18n/useT";
import { getRecognitionCtor } from "@/lib/speech/recognition";
import { Icon } from "@/components/ui/icons";

/** Big amber pill: opens the voice entry and starts listening at once. Unsupported browsers go to the D8 card. */
export function SpeakButton() {
  const t = useT();
  const [supported, setSupported] = useState(true);
  useEffect(() => setSupported(getRecognitionCtor() !== null), []);
  return supported ? (
    <Link href="/add/voice?autostart=1" className="home-speak">
      <Icon name="mic" size={40} />
      {t("home.speak")}
    </Link>
  ) : (
    <Link href="/add/voice" className="home-speak home-speak--off" aria-disabled="true">
      <Icon name="mic" size={40} />
      <span>{t("home.speakUnsupported")}</span>
    </Link>
  );
}
