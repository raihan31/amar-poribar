import type { ReactNode } from "react";
import { cx } from "./cx";
import { Icon, type IconName } from "./icons";

export type BannerTone = "info" | "warn" | "danger";

const ICON: Record<BannerTone, IconName> = { info: "info", warn: "warning", danger: "warning" };

export function Banner({ tone = "info", children }: { tone?: BannerTone; children: ReactNode }) {
  return (
    <div role={tone === "info" ? "status" : "alert"} className={cx("ui-banner", `ui-banner--${tone}`)}>
      <Icon name={ICON[tone]} />
      <div>{children}</div>
    </div>
  );
}
