import { describe, expect, it } from "vitest";
import { DEFAULT_CATEGORIES } from "./categories.js";
import { CATEGORY_ICON_IDS, EMOJI_TO_ICON } from "./icons.js";

const OLD_EMOJI = [
  "🛒",
  "🏠",
  "💡",
  "🔥",
  "🚰",
  "📶",
  "📱",
  "🛺",
  "📚",
  "💊",
  "🧹",
  "👕",
  "🍛",
  "🤝",
  "🕌",
  "🎉",
  "🎁",
  "🧺",
  "🧴",
  "🎬",
  "🏦",
  "🧾",
  "📦",
  "💼",
  "🏪",
  "✈️",
  "🏘️",
  "💰",
];

describe("category icons", () => {
  it("every default icon is a known id", () => {
    const ids = new Set<string>(CATEGORY_ICON_IDS);
    expect(DEFAULT_CATEGORIES).toHaveLength(28);
    for (const c of DEFAULT_CATEGORIES) expect(ids.has(c.icon), c.key).toBe(true);
  });

  it("emoji map covers old values", () => {
    const ids = new Set<string>(CATEGORY_ICON_IDS);
    for (const e of OLD_EMOJI) expect(ids.has(EMOJI_TO_ICON[e] ?? ""), e).toBe(true);
  });
});
