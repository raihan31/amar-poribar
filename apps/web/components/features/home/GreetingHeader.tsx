"use client";

import { useRouter } from "next/navigation";
import { dhakaHour, greetingKey } from "@/lib/home/greeting";
import { useT } from "@/lib/i18n/useT";
import { IconButton } from "@/components/ui/IconButton";

/** Time-of-day greeting, the family title and the settings gear. */
export function GreetingHeader({ name, familyName, now }: { name: string; familyName: string; now?: Date }) {
  const t = useT();
  const router = useRouter();
  return (
    <header className="home-header">
      <div>
        <div className="home-greeting">{t(greetingKey(dhakaHour(now)), { name })}</div>
        <h1 className="home-title">{familyName}</h1>
      </div>
      <IconButton
        icon="gear"
        label={t("home.settings")}
        style={{ width: 56, height: 56 }}
        onClick={() => router.push("/settings")}
      />
    </header>
  );
}
