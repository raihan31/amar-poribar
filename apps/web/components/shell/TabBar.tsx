"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useUnreadCount } from "@/lib/hooks/useUnreadCount";
import { useFormat } from "@/lib/i18n/format";
import { useT, type TKey } from "@/lib/i18n/useT";
import { Icon, type IconName } from "../ui/icons";
import { useFamily } from "./useFamily";

export const TABS: ReadonlyArray<{ href: string; icon: IconName; label: TKey }> = [
  { href: "/", icon: "home", label: "nav.home" },
  { href: "/chat", icon: "chat", label: "nav.chat" },
  { href: "/list", icon: "list", label: "nav.list" },
  { href: "/budget", icon: "budget", label: "nav.budget" },
  { href: "/family", icon: "family", label: "nav.family" },
];

/** The bar shows only on the five tab roots; every deeper (pushed) screen has a back header instead. */
export function showTabs(pathname: string | null): boolean {
  const p = (pathname ?? "/").replace(/\/+$/, "") || "/";
  return TABS.some((tab) => tab.href === p);
}

export function TabBar() {
  const t = useT();
  const { num } = useFormat();
  const pathname = usePathname();
  const { family } = useFamily();
  const unread = useUnreadCount(family.id);
  if (!showTabs(pathname)) return null;
  const current = (pathname ?? "/").replace(/\/+$/, "") || "/";

  return (
    <nav className="tabbar" aria-label={t("nav.main")}>
      {TABS.map((tab) => {
        const active = tab.href === current;
        return (
          <Link key={tab.href} href={tab.href} className="tabbar-item" aria-current={active ? "page" : undefined}>
            <span className="tabbar-icon">
              <Icon name={tab.icon} size={26} />
              {tab.href === "/chat" && unread > 0 && (
                <span className="tabbar-badge" aria-label={t("nav.unread", { n: num(unread) })}>
                  {num(unread)}
                </span>
              )}
            </span>
            <span className="tabbar-label">{t(tab.label)}</span>
          </Link>
        );
      })}
    </nav>
  );
}
