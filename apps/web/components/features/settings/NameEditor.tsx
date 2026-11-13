"use client";

import { useState } from "react";
import { Avatar } from "@/components/ui/Avatar";
import { Button } from "@/components/ui/Button";
import { Field } from "@/components/ui/Field";
import { useT } from "@/lib/i18n/useT";

export interface NameEditorProps {
  name: string;
  /** Rejects when the save fails; the editor stays open and shows an alert. */
  onSave: (name: string) => Promise<unknown>;
}

/** Avatar and name with a "বদলান" button that opens an inline editor. */
export function NameEditor({ name, onSave }: NameEditorProps) {
  const t = useT();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(name);
  const [failed, setFailed] = useState(false);
  const [busy, setBusy] = useState(false);

  async function save() {
    const next = draft.trim();
    if (!next || next === name) {
      setEditing(false);
      return;
    }
    setBusy(true);
    setFailed(false);
    try {
      await onSave(next);
      setEditing(false);
    } catch {
      setFailed(true);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="set-name">
      <Avatar name={name || "?"} size={64} />
      {editing ? (
        <form
          className="set-name__form"
          onSubmit={(e) => {
            e.preventDefault();
            void save();
          }}
        >
          <Field label={t("prof.name")} value={draft} onChange={(e) => setDraft(e.target.value)} maxLength={80} />
          {failed && <p role="alert">{t("prof.nameFailed")}</p>}
          <div className="set-name__actions">
            <Button type="submit" disabled={busy || !draft.trim()}>
              {t("prof.save")}
            </Button>
            <Button variant="secondary" onClick={() => setEditing(false)}>
              {t("prof.cancel")}
            </Button>
          </div>
        </form>
      ) : (
        <>
          <span className="set-name__text">{name}</span>
          <Button
            variant="secondary"
            onClick={() => {
              setDraft(name);
              setFailed(false);
              setEditing(true);
            }}
          >
            {t("prof.change")}
          </Button>
        </>
      )}
    </div>
  );
}
