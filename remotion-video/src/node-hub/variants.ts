/**
 * The three node-hub variants.
 *
 * This is the ONLY place in the project that holds a colour value, an icon
 * name, or a piece of on-screen label copy. Every component reads what it
 * needs from the active VariantConfig, so the renderer never knows which
 * version it is drawing — adding a fourth variant is a data change here and
 * one Composition entry in Root.tsx.
 */
import { mixHex } from "./color";
import type { IconName } from "./icons";

export type VariantId = "ai" | "download" | "medical";

export type Palette = {
  /** Deep field the whole frame sits on. */
  bgDeep: string;
  /** Broad soft wash behind the hub. */
  bgWash: string;
  /** The broken arc segments and tick ring. */
  hubArc: string;
  /** Dim companion to hubArc: unlit blocks, secondary chrome. */
  hubDim: string;
  /** Bright hub detail and hub text. */
  hubText: string;
  /** The one warm/contrasting hue, when a variant has one. */
  accent: string | null;
  /** Satellite icons and their circles. */
  nodeWhite: string;
  nodeDim: string;
  /** Straight hub-to-node and node-to-node connectors. */
  connector: string | null;
  connectorBright: string | null;
  /** The curved rails satellites sit on, when the layout uses them. */
  arcLine: string | null;
  panelBorder: string;
  textPale: string;
  textBright: string;
  starPale: string;
};

export type CentreConfig =
  /** A rounded chip with pin teeth along all four edges and lettering inside. */
  | { kind: "chip"; text: string }
  /** A ring of thick blocks that light up progressively, then extinguish. */
  | { kind: "progressDial"; text: string; blocks: number; cycles: number }
  /** A single large line glyph, rimmed and glowing, from the icon registry. */
  | { kind: "glyph"; icon: IconName };

export type LayoutMode = "radiating" | "arcs";

export type LayoutConfig = {
  mode: LayoutMode;
  /** Zero removes satellites and their connectors entirely. */
  count: number;
};

export type PanelDensity = "sparse" | "moderate" | "dense";

export type ChromeConfig = {
  density: PanelDensity;
  /** Large two-digit readouts stacked down the left edge. */
  bigReadouts: number;
  /** Dense full-width value/bar strip along the bottom edge. */
  bottomStrip: boolean;
};

export type LabelConfig = {
  text: string;
  anchor: "lower-left" | "lower-right";
  /** Cap height in 4K pixels. */
  size: number;
  /** Thin rule under the text. */
  underline: boolean;
  /** Bracketed chrome plate around the text. */
  plate: boolean;
};

export type VariantConfig = {
  id: VariantId;
  palette: Palette;
  centre: CentreConfig;
  layout: LayoutConfig;
  icons: readonly IconName[];
  label: LabelConfig | null;
  chrome: ChromeConfig;
};

// Raw palette values, kept adjacent to the variants that own them.
const AI = {
  bgDeep: "#030A20",
  bgWash: "#0C1E4A",
  hubCyan: "#4FC4F5",
  hubWhite: "#E8F8FF",
  nodeWhite: "#FFFFFF",
  nodeDim: "#6F8FB8",
  connector: "#2E5FA8",
  connectorBright: "#7FB8E8",
  panelBorder: "#2E5C8A",
  textPale: "#7FA8C4",
  starPale: "#5F7FA8",
} as const;

const DOWNLOAD = {
  bgDeep: "#010A18",
  bgWash: "#06203F",
  hubBlue: "#2E7FD4",
  hubWhite: "#D8F0FF",
  accentAmber: "#F5C43F",
  panelBorder: "#1E5478",
  textPale: "#5F9FC4",
  textBright: "#E8F8FF",
  starPale: "#4A6B8A",
} as const;

const MEDICAL = {
  bgDeep: "#020818",
  bgWash: "#081A38",
  hubWhite: "#FFFFFF",
  hubDim: "#4A6B8A",
  nodeWhite: "#FFFFFF",
  nodeDim: "#6F8FB8",
  arcLine: "#8AA8C4",
  panelBorder: "#2A4A6B",
  textPale: "#A8C4D8",
  starPale: "#4A6B8A",
} as const;

export const VARIANTS: Record<VariantId, VariantConfig> = {
  /**
   * v1 — a chip at the centre of a radiating, cross-linked network of tech
   * icons. Cyan is its signature.
   */
  ai: {
    id: "ai",
    palette: {
      bgDeep: AI.bgDeep,
      bgWash: AI.bgWash,
      hubArc: AI.hubCyan,
      // No separate dim hub tone is specified for this variant, so it is
      // derived from the two colours that are, rather than inventing a hex.
      hubDim: mixHex(AI.hubCyan, AI.bgDeep, 0.62),
      hubText: AI.hubWhite,
      accent: null,
      nodeWhite: AI.nodeWhite,
      nodeDim: AI.nodeDim,
      connector: AI.connector,
      connectorBright: AI.connectorBright,
      arcLine: null,
      panelBorder: AI.panelBorder,
      textPale: AI.textPale,
      textBright: AI.hubWhite,
      starPale: AI.starPale,
    },
    centre: { kind: "chip", text: "AI" },
    layout: { mode: "radiating", count: 14 },
    icons: [
      "chip",
      "robotHead",
      "cloud",
      "database",
      "document",
      "lock",
      "monitor",
      "gear",
      "lightBulb",
      "networkCluster",
      "mobileDevice",
      "serverRack",
      "brain",
      "magnifier",
    ],
    label: {
      text: "ARTIFICIAL TECHNOLOGY",
      anchor: "lower-left",
      size: 46,
      underline: false,
      plate: true,
    },
    chrome: { density: "moderate", bigReadouts: 0, bottomStrip: false },
  },

  /**
   * v2 — one process, not a network: no satellites, no connectors. A
   * segmented amber progress dial is the only warm element in an otherwise
   * entirely blue frame, and the freed space is filled with dense chrome.
   */
  download: {
    id: "download",
    palette: {
      bgDeep: DOWNLOAD.bgDeep,
      bgWash: DOWNLOAD.bgWash,
      hubArc: DOWNLOAD.hubBlue,
      hubDim: mixHex(DOWNLOAD.hubBlue, DOWNLOAD.bgDeep, 0.62),
      hubText: DOWNLOAD.hubWhite,
      accent: DOWNLOAD.accentAmber,
      nodeWhite: DOWNLOAD.hubWhite,
      nodeDim: DOWNLOAD.textPale,
      connector: null,
      connectorBright: null,
      arcLine: null,
      panelBorder: DOWNLOAD.panelBorder,
      textPale: DOWNLOAD.textPale,
      textBright: DOWNLOAD.textBright,
      starPale: DOWNLOAD.starPale,
    },
    centre: {
      kind: "progressDial",
      text: "DOWNLOADING",
      blocks: 24,
      cycles: 3,
    },
    layout: { mode: "radiating", count: 0 },
    icons: [],
    label: null,
    chrome: { density: "dense", bigReadouts: 4, bottomStrip: true },
  },

  /**
   * v3 — icons strung along intersecting curved rails, the hub sitting where
   * two of them cross. White line work only: no accent hue at all, and that
   * restraint is the point.
   */
  medical: {
    id: "medical",
    palette: {
      bgDeep: MEDICAL.bgDeep,
      bgWash: MEDICAL.bgWash,
      hubArc: MEDICAL.hubWhite,
      hubDim: MEDICAL.hubDim,
      hubText: MEDICAL.hubWhite,
      accent: null,
      nodeWhite: MEDICAL.nodeWhite,
      nodeDim: MEDICAL.nodeDim,
      connector: null,
      connectorBright: null,
      arcLine: MEDICAL.arcLine,
      panelBorder: MEDICAL.panelBorder,
      textPale: MEDICAL.textPale,
      textBright: MEDICAL.hubWhite,
      starPale: MEDICAL.starPale,
    },
    // The spec fixes v1's chip and v2's dial but leaves v3's centre open. A
    // chip reading "AI" would be wrong here, so the hub holds the set's own
    // cross glyph — same rim/fill/glow treatment, no new colour or copy.
    centre: { kind: "glyph", icon: "hexCross" },
    layout: { mode: "arcs", count: 18 },
    icons: [
      "stethoscope",
      "heart",
      "hexCross",
      "pillCapsule",
      "clipboardCheck",
      "hospitalBuilding",
      "ambulance",
      "shieldCross",
      "syringe",
      "dnaHelix",
      "bandagedFigure",
      "firstAidCase",
      "sealedDocument",
      "pulseMonitor",
    ],
    label: {
      text: "MEDICAL INSURANCE",
      anchor: "lower-right",
      size: 74,
      underline: true,
      plate: false,
    },
    chrome: { density: "sparse", bigReadouts: 0, bottomStrip: false },
  },
};
