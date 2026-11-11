"use client";

import { useState } from "react";
import { Button } from "./Button";

export function CopyButton({ value, label = "Copy" }: { value: string; label?: string }) {
  const [done, setDone] = useState(false);
  async function copy() {
    try {
      await navigator.clipboard.writeText(value);
      setDone(true);
      setTimeout(() => setDone(false), 2000);
    } catch {
      setDone(false);
    }
  }
  return <Button onClick={copy}>{done ? "Copied" : label}</Button>;
}
