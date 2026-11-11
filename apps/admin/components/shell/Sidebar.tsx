"use client";

import { useQuery } from "@tanstack/react-query";
import { usePathname } from "next/navigation";
import { api } from "@/lib/api/client";
import { qk } from "@/lib/api/queryKeys";

export const NAV = [
  { href: "/", label: "Overview" },
  { href: "/families", label: "Families" },
  { href: "/privacy", label: "Privacy requests", badge: true },
  { href: "/plans", label: "Plans & AI quota" },
  { href: "/audit", label: "Audit log" },
  { href: "/staff", label: "Staff accounts" },
  { href: "/health", label: "System health" },
] as const;

function isActive(path: string, href: string): boolean {
  return href === "/" ? path === "/" : path === href || path.startsWith(`${href}/`);
}

export function Sidebar() {
  const path = usePathname() ?? "/";
  const { data } = useQuery({
    queryKey: qk.overview(),
    queryFn: () => api<{ openPrivacyRequests?: number }>("/admin/v1/overview"),
  });
  const open = data?.openPrivacyRequests ?? 0;
  return (
    <nav className="sidebar" aria-label="Console">
      <div className="sidebar__head">
        <div className="sidebar__brand">আমার পরিবার</div>
        <div className="sidebar__sub">Admin console</div>
      </div>
      <ul>
        {NAV.map((item) => {
          const active = isActive(path, item.href);
          return (
            <li key={item.href}>
              <a
                href={item.href}
                className={active ? "nv nv--active" : "nv"}
                aria-current={active ? "page" : undefined}
              >
                {item.label}
                {"badge" in item && open > 0 && (
                  <span className="nv__badge" aria-label={`${open} open`}>
                    {open}
                  </span>
                )}
              </a>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
