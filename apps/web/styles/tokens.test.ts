import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { cssVarNames, darkTokens, lightTokens, type ColorTokens } from "@amar-poribar/shared";

function channel(v: number): number {
  const c = v / 255;
  return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
}
function luminance(hex: string): number {
  const n = parseInt(hex.slice(1), 16);
  return 0.2126 * channel((n >> 16) & 255) + 0.7152 * channel((n >> 8) & 255) + 0.0722 * channel(n & 255);
}
function contrast(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi! + 0.05) / (lo! + 0.05);
}

const pairs = (t: ColorTokens): Array<[string, string, string]> => [
  ["ink/bg", t.ink, t.bg],
  ["ink/card", t.ink, t.card],
  ["muted/bg", t.muted, t.bg],
  ["onGreen/green700", t.onGreen, t.green700],
  ["ink/amber", t.onAmber, t.amber],
  ["danger/card", t.danger, t.card],
  ["onDanger/danger", t.onDanger, t.danger],
  ["green700/bg", t.green700, t.bg],
  ["ink/green100", t.ink, t.green100],
];

describe("design tokens", () => {
  it("all pairs meet 4.5:1", () => {
    for (const [name, t] of [
      ["light", lightTokens],
      ["dark", darkTokens],
    ] as const) {
      for (const [pair, fg, bg] of pairs(t)) {
        expect(contrast(fg, bg), `${name} ${pair}`).toBeGreaterThanOrEqual(4.5);
      }
    }
  });

  it("tokens.css mirrors design-tokens.ts", () => {
    const css = readFileSync(resolve(__dirname, "tokens.css"), "utf8");
    const dark = css.slice(css.indexOf('[data-theme="dark"]'));
    for (const key of Object.keys(cssVarNames) as Array<keyof ColorTokens>) {
      const v = cssVarNames[key];
      expect(css.toLowerCase()).toContain(`${v}: ${lightTokens[key].toLowerCase()};`);
      expect(dark.toLowerCase()).toContain(`${v}: ${darkTokens[key].toLowerCase()};`);
    }
  });
});
