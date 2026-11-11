/** Token source (T-WEB-06). `apps/web/styles/tokens.css` must mirror these values; tokens.test.ts checks it. */
export interface ColorTokens {
  bg: string;
  card: string;
  ink: string;
  muted: string;
  green700: string;
  green100: string;
  amber: string;
  danger: string;
  border: string;
  onGreen: string;
  onAmber: string;
  onDanger: string;
}

export const lightTokens: ColorTokens = {
  bg: "#FFF8EE",
  card: "#FFFFFF",
  ink: "#2A2118",
  muted: "#5A4B3B",
  green700: "#1B5E20",
  green100: "#E6F2E3",
  amber: "#F2A33A",
  danger: "#B3261E",
  border: "#E8DCC8",
  onGreen: "#FFFFFF",
  onAmber: "#2A2118",
  onDanger: "#FFFFFF",
};

export const darkTokens: ColorTokens = {
  bg: "#151614",
  card: "#1F201D",
  ink: "#ECEBE6",
  muted: "#B7B6AE",
  green700: "#4CAF50",
  green100: "#1E3A21",
  amber: "#F2A33A",
  danger: "#F2827A",
  border: "#33342F",
  onGreen: "#151614",
  onAmber: "#2A2118",
  onDanger: "#151614",
};

export const radii = { card: "22px", pill: "999px" } as const;

/** CSS custom property name for each colour token, e.g. green700 is --green-700. */
export const cssVarNames: Record<keyof ColorTokens, string> = {
  bg: "--bg",
  card: "--card",
  ink: "--ink",
  muted: "--muted",
  green700: "--green-700",
  green100: "--green-100",
  amber: "--amber",
  danger: "--danger",
  border: "--border",
  onGreen: "--on-green",
  onAmber: "--on-amber",
  onDanger: "--on-danger",
};
