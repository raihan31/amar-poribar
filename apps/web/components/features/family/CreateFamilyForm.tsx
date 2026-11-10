"use client";

import { useState } from "react";
import { api } from "@/lib/api";
import type { Family } from "@/lib/types";

export function CreateFamilyForm({ token, onCreated }: { token: string; onCreated: (f: Family) => void }) {
  const [name, setName] = useState("");
  return (
    <div className="card">
      <p>আপনার পরিবারের নাম দিন</p>
      <div className="row">
        <input value={name} placeholder="যেমন: রহমান পরিবার" onChange={(e) => setName(e.target.value)} />
        <button onClick={async () => onCreated(await api<Family>("/v1/families", { body: { name }, token }))}>
          তৈরি করুন
        </button>
      </div>
    </div>
  );
}
