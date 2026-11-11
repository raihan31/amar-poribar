"use client";

import Link from "next/link";
import { useT } from "@/lib/i18n/useT";
import { Icon } from "../ui/icons";

/** Header for tab screens; `gear` adds the settings link (Home and the family tab). */
export function PageHeader({ title, gear = false }: { title: string; gear?: boolean }) {
  const t = useT();
  return (
    <header className="page-header">
      <h1>{title}</h1>
      {gear && (
        <Link href="/settings" className="ui-iconbtn" aria-label={t("nav.settings")}>
          <Icon name="gear" size={26} />
        </Link>
      )}
    </header>
  );
}
