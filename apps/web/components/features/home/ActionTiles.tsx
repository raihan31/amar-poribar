"use client";

import Link from "next/link";
import { useT, type TKey } from "@/lib/i18n/useT";
import { Icon, type IconName } from "@/components/ui/icons";

const TILES: ReadonlyArray<{ href: string; icon: IconName; label: TKey; amber?: boolean }> = [
  { href: "/buzz", icon: "buzz", label: "home.tileBuzz", amber: true },
  { href: "/chat", icon: "chat", label: "home.tileChat" },
  { href: "/call/new", icon: "video", label: "home.tileVideo" },
];

export function ActionTiles() {
  const t = useT();
  return (
    <div className="home-tiles">
      {TILES.map((x) => (
        <Link key={x.href} href={x.href} className={`home-tile${x.amber ? " home-tile--amber" : ""}`}>
          <Icon name={x.icon} size={30} />
          {t(x.label)}
        </Link>
      ))}
    </div>
  );
}
