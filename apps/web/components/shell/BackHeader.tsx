"use client";

import { useRouter } from "next/navigation";
import { useT } from "@/lib/i18n/useT";
import { IconButton } from "../ui/IconButton";

/** Header for pushed screens: a 56 px back button and the title; no tab bar. */
export function BackHeader({ title }: { title: string }) {
  const t = useT();
  const router = useRouter();
  return (
    <header className="page-header back-header">
      <IconButton icon="back" label={t("nav.back")} onClick={() => router.back()} />
      <h1>{title}</h1>
    </header>
  );
}
