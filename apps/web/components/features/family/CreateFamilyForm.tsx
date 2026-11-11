"use client";

import { useState } from "react";
import { api } from "@/lib/api/client";
import { useT } from "@/lib/i18n/useT";
import type { Family } from "@/lib/types";

export function CreateFamilyForm({ onCreated }: { onCreated: (f: Family) => void }) {
  const t = useT();
  const [name, setName] = useState("");
  return (
    <div className="card">
      <p>{t("family.createPrompt")}</p>
      <div className="row">
        <input value={name} placeholder={t("family.namePlaceholder")} onChange={(e) => setName(e.target.value)} />
        <button onClick={async () => onCreated(await api<Family>("/v1/families", { body: { name } }))}>
          {t("family.create")}
        </button>
      </div>
    </div>
  );
}
