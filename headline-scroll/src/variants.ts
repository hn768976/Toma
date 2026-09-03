/**
 * The single source of truth for everything that differs between the two
 * versions of the piece. No hex literal and no headline string exists
 * anywhere else in this project.
 *
 * IMPORTANT — all editorial content below is INVENTED. The headlines,
 * wordmarks, bylines, section labels and dates do not refer to, quote or
 * imitate any real publication, journalist or article.
 */

export type VariantName = "light" | "paper";
export type Axis = "vertical" | "horizontal";

export interface Palette {
  /** The ground the cards sit on — visible in the gaps between them. */
  background: string;
  /** The page surface of most cards. */
  cardBase: string;
  /** A minority of cards use this slightly off tone instead. */
  cardAlt: string;
  /** Headlines and the keyword. */
  inkBlack: string;
  /** Bylines, section labels, chrome. */
  inkMid: string;
  /** Body filler. */
  inkLight: string;
  /** The dark top bands. */
  ruleDark: string;
  /** The accent band on some cards. */
  ruleAccent: string;
  /** Image placeholders. */
  imageGrey: string;
  /** Drop shadow beneath a card (paper only). */
  shadow: string;
  /** Mottled paper texture tone (paper only). */
  texture: string;
  /** Colour the vignette lightens the corners with. */
  vignette: string;
}

export interface Variant {
  palette: Palette;
  /** Invented headlines. Every one contains `keyword`. */
  headlines: string[];
  /** The word held in focus while the rest of the line blurs away. */
  keyword: string;
  /** Cards in one tiled block. */
  cardCount: number;
  axis: Axis;
  /** Card extent along the scroll axis, in 4K device pixels. */
  mainMin: number;
  mainMax: number;
  /** Card extent across the scroll axis, in 4K device pixels. */
  crossMin: number;
  crossMax: number;
  /** How far consecutive cards overlap along the scroll axis. */
  overlapMin: number;
  overlapMax: number;
  /** Base headline size; each card scales this by 0.80–1.19 (~40% spread). */
  headlineSize: number;
  /** Multiplier on the spacing stacked above the headline. */
  headroom: number;
  /**
   * Where the keyword lands across the scroll axis, as a fraction of the
   * frame's cross dimension. Roughly centred; nudged off centre where that
   * seats the cards better in the frame.
   */
  anchorCross: number;
  /** Probability a given card sets its headline in the serif. */
  serifBias: number;
  /** Section labels are small-caps serif rather than sans. */
  serifLabels: boolean;
  /** Paper character: mottled texture, drop shadow, slight tilt. */
  paper: boolean;
  /** Maximum absolute card rotation, in degrees. */
  tiltDeg: number;
  /** Shutter fraction of one frame's travel used as motion blur. */
  shutter: number;
  /** The keyword's share of that motion blur — always less than `shutter`. */
  keywordShutter: number;
  /** Peak focus blur within a headline, as a fraction of the font size. */
  focusBlurMax: number;
  /**
   * How quickly the blur climbs away from the keyword, as a fraction of the
   * headline measure. A short keyword wants a tighter focus point.
   */
  focusFalloff: number;
  /** How much the corners are lightened, 0–1. */
  vignetteStrength: number;
  /** Generic invented wordmarks for the site chrome. */
  wordmarks: string[];
  /** Generic category words. */
  sections: string[];
  /** Generic bylines — no real names. */
  bylines: string[];
  /** Plausible but generic dates, deliberately carrying no year. */
  dates: string[];
  /** Generic breadcrumb trails. */
  breadcrumbs: string[][];
}

const LIGHT: Variant = {
  palette: {
    background: "#E8E8EA",
    cardBase: "#FFFFFF",
    cardAlt: "#F4F4F6",
    inkBlack: "#111318",
    inkMid: "#3A3E46",
    inkLight: "#9BA0A8",
    ruleDark: "#16182A",
    ruleAccent: "#2E4FD4",
    imageGrey: "#D4D6DA",
    shadow: "#16182A",
    texture: "#16182A",
    vignette: "#FFFFFF",
  },
  headlines: [
    "Artificial intelligence is starting to reshape weather forecasting",
    "How artificial intelligence could help save lives",
    "Artificial intelligence tools are everywhere. Here's the best of them",
    "Artificial intelligence to free up more time for accountants",
    "Researchers say artificial intelligence still struggles with context",
    "The quiet spread of artificial intelligence in public services",
    "Regulators weigh new limits on artificial intelligence",
  ],
  keyword: "intelligence",
  cardCount: 7,
  axis: "vertical",
  mainMin: 1240,
  mainMax: 1760,
  crossMin: 3000,
  crossMax: 4200,
  overlapMin: 34,
  overlapMax: 96,
  headlineSize: 128,
  headroom: 1.0,
  anchorCross: 0.5,
  serifBias: 0.5,
  serifLabels: false,
  paper: false,
  tiltDeg: 0,
  shutter: 0.55,
  keywordShutter: 0.2,
  focusBlurMax: 0.15,
  focusFalloff: 0.42,
  vignetteStrength: 0.08,
  wordmarks: ["DAILY", "BULLETIN", "THE DIGEST", "REPORT", "NEWSDESK", "REVIEW", "JOURNAL"],
  sections: ["TECHNOLOGY", "SCIENCE", "BUSINESS", "INDUSTRY", "POLICY", "INNOVATION"],
  bylines: ["By Staff Writer", "By Technology Desk", "By Contributing Reporter", "By Science Desk"],
  dates: ["March 14", "April 2", "January 27", "October 9", "June 18", "February 5", "August 21"],
  breadcrumbs: [
    ["Home", "Industry"],
    ["Home", "Technology"],
    ["Home", "Science", "Research"],
    ["Home", "Business"],
  ],
};

const PAPER: Variant = {
  palette: {
    background: "#D8D0BE",
    cardBase: "#F2EBDA",
    cardAlt: "#EDE4CE",
    inkBlack: "#1A1610",
    inkMid: "#4A4238",
    inkLight: "#9A9080",
    ruleDark: "#2A2418",
    ruleAccent: "#A8452E",
    imageGrey: "#CFC7B4",
    shadow: "#2A2418",
    texture: "#4A4238",
    vignette: "#F7F1E4",
  },
  headlines: [
    "What AI still cannot do",
    "The AI boom reaches the factory floor",
    "Small firms turn to AI to close the skills gap",
    "Inside the race to make AI cheaper to run",
    "AI in the classroom: promise and caution",
    "Why AI forecasts are getting better",
    "The hidden cost of running AI at scale",
  ],
  keyword: "AI",
  cardCount: 5,
  axis: "horizontal",
  mainMin: 2300,
  mainMax: 2950,
  crossMin: 2300,
  crossMax: 3100,
  overlapMin: 40,
  overlapMax: 110,
  headlineSize: 118,
  headroom: 1.55,
  anchorCross: 0.44,
  serifBias: 0.7,
  serifLabels: true,
  paper: true,
  tiltDeg: 1.5,
  shutter: 0.55,
  keywordShutter: 0.2,
  focusBlurMax: 0.17,
  focusFalloff: 0.24,
  vignetteStrength: 0.08,
  wordmarks: ["THE DIGEST", "BULLETIN", "DAILY", "GAZETTE", "REVIEW"],
  sections: ["TECHNOLOGY", "SCIENCE", "BUSINESS", "INDUSTRY", "POLICY", "COMMENT"],
  bylines: ["By Staff Writer", "By Technology Desk", "By Contributing Reporter", "By Industry Desk"],
  dates: ["March 14", "April 2", "November 30", "July 7", "May 16", "September 3", "December 11"],
  breadcrumbs: [
    ["Home", "Industry"],
    ["Home", "Technology"],
    ["Home", "Business", "Analysis"],
    ["Home", "Comment"],
  ],
};

export const VARIANTS: Record<VariantName, Variant> = {
  light: LIGHT,
  paper: PAPER,
};
