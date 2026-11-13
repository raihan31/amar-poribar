"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { Icon, type IconName } from "@/components/ui/icons";
import { cx } from "@/components/ui/cx";

export type RowTone = "plain" | "green" | "danger";

export interface RowTextProps {
  title: string;
  sub?: string;
  tone?: RowTone;
  titleId?: string;
}

export function RowText({ title, sub, tone = "plain", titleId }: RowTextProps) {
  return (
    <span className="set-row__text">
      <span id={titleId} className={cx("set-row__title", tone === "green" && "set-row__title--big")}>
        {title}
      </span>
      {sub && <span className="set-row__sub">{sub}</span>}
    </span>
  );
}

export interface SettingRowProps extends RowTextProps {
  /** Internal route: the row is a link with a chevron. */
  href?: string;
  /** Plain download link (e.g. a CSV). */
  download?: string;
  onClick?: () => void;
  /** Replaces the chevron (e.g. a speaker icon). */
  icon?: IconName;
  children?: ReactNode;
}

/** A 68 px settings row: text on the left, a chevron, icon or control on the right. */
export function SettingRow({ title, sub, tone = "plain", href, download, onClick, icon, children }: SettingRowProps) {
  const cls = cx("set-row", tone === "green" && "set-row--green", tone === "danger" && "set-row--danger");
  const body = (
    <>
      <RowText title={title} sub={sub} tone={tone} />
      {children}
      {(href || download || onClick) && (
        <Icon name={icon ?? "back"} size={24} className={icon ? undefined : "set-row__chev"} />
      )}
    </>
  );
  if (download) {
    return (
      <a className={cls} href={download} download>
        {body}
      </a>
    );
  }
  if (href) {
    return (
      <Link className={cls} href={href}>
        {body}
      </Link>
    );
  }
  if (onClick) {
    return (
      <button type="button" className={cls} onClick={onClick}>
        {body}
      </button>
    );
  }
  return <div className={cls}>{body}</div>;
}
