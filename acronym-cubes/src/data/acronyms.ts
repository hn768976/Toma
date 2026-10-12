import type { IconId } from "../icons/icons";

/**
 * One data row per version. Adding a new acronym = adding a row here
 * (see README "How to add a new acronym").
 */
export type AcronymRow = {
  /**
   * Output name (AcronymCubes_XXX). Remotion ids may not contain "_", so the
   * composition id is this name with "_" → "-" (see compositionId()).
   */
  id: string;
  /** The hero word exactly as it should be spelled (case matters: IoT, SaaS). */
  word: string;
  /** Base icons on the cubes (2–5 of them, ~88% of cubes share these evenly). */
  icons: IconId[];
  /** The accent icon (~12% of cubes), drawn in the accent colour. */
  accentIcon: IconId;
  /** Field colour at the far / top edge of the frame. */
  colorA: string;
  /** Field colour at the near / bottom edge of the frame. */
  colorB: string;
  /** Colour of the letters' front faces (blends to white at the top). */
  letterFace: string;
  /** CBDC only: currency-style notches above and below every letter. */
  coinNotches: boolean;
  /** Optional overrides (defaults below). */
  iconColor?: string;
  accentColor?: string;
};

export const ICON_COLOR = "#BFF4FF";
export const ACCENT_COLOR = "#FFC85A";

export const ACRONYMS: AcronymRow[] = [
  {
    id: "AcronymCubes_CBDC",
    word: "CBDC",
    icons: ["dollar", "euro", "pound", "yen"],
    accentIcon: "padlock",
    colorA: "#3A6AE8",
    colorB: "#8A3AE8",
    letterFace: "#9AF0FF",
    coinNotches: true,
  },
  {
    id: "AcronymCubes_AI",
    word: "AI",
    icons: ["chip", "brain", "binary"],
    accentIcon: "sparkle",
    colorA: "#2AB8E8",
    colorB: "#6A3AE8",
    letterFace: "#DFF8FF",
    coinNotches: false,
  },
  {
    id: "AcronymCubes_ESG",
    word: "ESG",
    icons: ["leaf", "drop", "people"],
    accentIcon: "scale",
    colorA: "#1AA89A",
    colorB: "#2A8A4A",
    letterFace: "#C8FFE8",
    coinNotches: false,
  },
  {
    id: "AcronymCubes_IoT",
    word: "IoT",
    icons: ["wifi", "house", "thermometer"],
    accentIcon: "bulb",
    colorA: "#2AD8E8",
    colorB: "#2AB86A",
    letterFace: "#E8FFFA",
    coinNotches: false,
  },
  {
    id: "AcronymCubes_SaaS",
    word: "SaaS",
    icons: ["browser", "gear", "user"],
    accentIcon: "cloud",
    colorA: "#4AA8F0",
    colorB: "#7A5AE8",
    letterFace: "#F4F8FF",
    coinNotches: false,
  },
  {
    id: "AcronymCubes_API",
    word: "API",
    icons: ["braces", "arrows", "gear"],
    accentIcon: "plug",
    colorA: "#1AA8C8",
    colorB: "#2A5AD8",
    letterFace: "#BFF4FF",
    coinNotches: false,
  },
  {
    id: "AcronymCubes_ERP",
    word: "ERP",
    icons: ["factory", "box", "invoice"],
    accentIcon: "gear",
    colorA: "#1A3A8A",
    colorB: "#2A6AE8",
    letterFace: "#DFF8FF",
    coinNotches: false,
  },
  {
    id: "AcronymCubes_CRM",
    word: "CRM",
    icons: ["user", "chat", "envelope"],
    accentIcon: "handshake",
    colorA: "#1A9AA8",
    colorB: "#2A5AD8",
    letterFace: "#BFF4FF",
    coinNotches: false,
  },
  {
    id: "AcronymCubes_KPI",
    word: "KPI",
    icons: ["barchart", "gauge", "check"],
    accentIcon: "target",
    colorA: "#3A3AB8",
    colorB: "#7A3AD8",
    letterFace: "#F4F8FF",
    coinNotches: false,
  },
  {
    id: "AcronymCubes_LLM",
    word: "LLM",
    icons: ["chat", "textlines", "chip"],
    accentIcon: "sparkle",
    colorA: "#5A3AD8",
    colorB: "#B83AC8",
    letterFace: "#F0E8FF",
    coinNotches: false,
  },
];

/** Remotion composition id for a row: AcronymCubes_CBDC → AcronymCubes-CBDC. */
export const compositionId = (row: AcronymRow) => row.id.replace(/_/g, "-");
