"use client";

import { useT } from "@/lib/i18n/useT";
import type { Member } from "@/lib/types";
import { Avatar } from "@/components/ui/Avatar";

/** Avatars with a presence dot, the word and an aria-label: never colour alone (FR-PRES-01). */
export function FamilyRow({ members, online }: { members: Member[]; online: ReadonlySet<string> }) {
  const t = useT();
  return (
    <section className="home-family">
      <ul className="home-family-list">
        {members.map((m) => {
          const name = m.name ?? m.phone;
          const on = online.has(m.userId);
          const status = t(on ? "home.online" : "home.offline");
          return (
            <li key={m.userId} className="home-person" aria-label={t("home.presenceLabel", { name, status })}>
              <span className="home-avatar">
                <Avatar name={name} size={56} />
                <i className={`home-dot ${on ? "home-dot--on" : "home-dot--off"}`} aria-hidden="true" />
              </span>
              <span className="home-person-name">{name}</span>
              <span className="home-person-status">{status}</span>
            </li>
          );
        })}
      </ul>
      <p className="home-legend">{t("home.legend")}</p>
    </section>
  );
}
