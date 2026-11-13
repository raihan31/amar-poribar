import type { CSSProperties } from "react";
import type { HealthTile, TileStatus } from "./types";

const ICON: Record<TileStatus, string> = { ok: "✓", warn: "⚠", risk: "■" };
const WORD: Record<TileStatus, string> = { ok: "OK", warn: "Warning", risk: "At risk" };
const COLOR: Record<TileStatus, string | undefined> = { ok: undefined, warn: "#9a2a00", risk: "#a01010" };

const HIDDEN: CSSProperties = {
  position: "absolute",
  width: 1,
  height: 1,
  overflow: "hidden",
  clip: "rect(0 0 0 0)",
  whiteSpace: "nowrap",
};

/** Status comes from the API. Never colour alone: icon plus word. */
export function MetricTile({ tile }: { tile: HealthTile }) {
  const { status } = tile;
  const unit = tile.unit === "%" ? "%" : tile.unit ? ` ${tile.unit}` : "";
  return (
    <div className="kpi" data-testid={`tile-${tile.key}`}>
      <div className="muted">{tile.label}</div>
      <div className="kpi__value" style={{ fontSize: 30 }}>
        {`${tile.value}${unit}`}
      </div>
      <div
        data-status={status}
        className={status === "ok" ? "muted" : undefined}
        style={{ color: COLOR[status], fontWeight: status === "ok" ? undefined : 600 }}
      >
        <span aria-hidden="true">{ICON[status]}</span> <span style={HIDDEN}>{WORD[status]}:</span> {tile.note}
      </div>
    </div>
  );
}
