/**
 * The single source of truth for everything that differs between the two
 * versions: palette, headline set, bylines and drift direction.
 *
 * Every colour used anywhere in the piece is reachable from here. There is no
 * hex literal and no headline string in any other file — including the grain,
 * vignette, fibre-edge and light-gradient tints, which are derived from these
 * values by the helpers in ./color.
 */

export type VariantName = "fire" | "finance";

export type Palette = {
  /** Wall base, mid tone and deepest shade. */
  wallDeep: string;
  wallMid: string;
  wallDark: string;
  /** Newsprint stocks. Every clipping picks one, so paper is never uniform. */
  papers: string[];
  /** Ink for headlines and rules; the softer tone is for body and bylines. */
  inkBlack: string;
  inkSoft: string;
  /** Drop shadow beneath each clipping. */
  shadow: string;
  shadowAlpha: number;
  /**
   * Gamma applied to the wall's tone ramp. Above 1 pushes the wall towards its
   * dark end. The slate palette spans a much narrower range than the burnt-red
   * one, so it needs a gentler curve to show any texture at all.
   */
  wallGamma: number;
};

export type Drift = {
  /**
   * +1 drifts along the lattice vector (right and slightly down);
   * -1 drifts against it (left and slightly up).
   */
  sign: 1 | -1;
};

export type VariantFeatures = {
  /** Indices into the layout of clippings that carry a printed line chart. */
  chartSlots: number[];
  /** Indices of clippings that carry a halftone photograph placeholder. */
  halftoneSlots: number[];
};

export type Variant = {
  palette: Palette;
  headlines: string[];
  bylines: string[];
  drift: Drift;
  features: VariantFeatures;
};

export const VARIANTS: Record<VariantName, Variant> = {
  fire: {
    palette: {
      wallDeep: "#7A1E0A",
      wallMid: "#A83214",
      wallDark: "#4A1206",
      papers: ["#E8E0CE", "#D8DAD4", "#E0D4A8"],
      inkBlack: "#1A1A1A",
      inkSoft: "#4A4A4A",
      shadow: "#2A0A04",
      shadowAlpha: 0.3,
      wallGamma: 1.5,
    },
    headlines: [
      "Heatwaves return with a vengeance",
      "Fires quickly spread",
      "Regions brace for another 40° summer",
      "Firefighters on the frontline",
      "Homes destroyed as fires rage",
      "Temperatures set to rise again",
      "Emergency declared as crews battle flames",
      "A race against time",
      "Evacuations widen as winds shift",
      "Climate shifts are happening now",
    ],
    bylines: [
      "Staff Correspondent",
      "Regional Desk",
      "Weather Desk",
      "Our Correspondent",
    ],
    drift: { sign: 1 },
    features: { chartSlots: [], halftoneSlots: [] },
  },
  finance: {
    palette: {
      wallDeep: "#2A2C30",
      wallMid: "#3A3D42",
      wallDark: "#1A1C20",
      papers: ["#E8E4DA", "#DCDEE0", "#E8DCD8"],
      inkBlack: "#1A1A1A",
      inkSoft: "#4A4A4A",
      shadow: "#0A0B0D",
      shadowAlpha: 0.35,
      wallGamma: 1.05,
    },
    headlines: [
      "Markets tumble in early trade",
      "Investors flee to safety",
      "Worst quarter on record",
      "Central bank holds firm",
      "Confidence at a five-year low",
      "Sell-off deepens overnight",
      "Analysts warn of further falls",
      "A reckoning for the sector",
      "Bond yields spike as fears grow",
      "No end in sight, say traders",
    ],
    bylines: [
      "Financial Correspondent",
      "Markets Desk",
      "Staff Correspondent",
      "Economics Desk",
    ],
    drift: { sign: -1 },
    features: { chartSlots: [3, 7, 11], halftoneSlots: [5, 12] },
  },
};
