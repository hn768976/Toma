/**
 * One data row per version. To add a colourway, add a row to the right table
 * (see README "How to add a colourway"); Root.tsx registers one composition
 * per row.
 */

export type GlowVersion = {
  id: string; // composition id suffix and output file name
  label: string;
  /** Page background: vertical gradient top -> bottom. */
  base: [string, string];
  /** One colour per blob slot (see BLOB_SLOTS in GlowGradient.tsx). */
  blobs: string[];
  /** Light line colours along its length: [far side, hot centre, near side]. */
  line: [string, string, string];
};

export const GLOW_VERSIONS: GlowVersion[] = [
  {
    id: "Aurora",
    label: "1A Aurora",
    base: ["#02030C", "#050818"],
    // cyan, azure, violet, magenta, deep blue, deep blue, cyan, violet, magenta
    blobs: [
      "#2AD8FF", "#2A6AFF", "#7A3AFF", "#FF2AC8", "#1A2AAA",
      "#1A2AAA", "#2AD8FF", "#7A3AFF", "#FF2AC8",
    ],
    line: ["#2A6AFF", "#FFFFFF", "#FF5AC8"],
  },
  {
    id: "Sunset",
    label: "1B Sunset",
    base: ["#0A0308", "#12050E"],
    // orange, rose, gold, magenta, deep plum, deep plum, orange, rose, magenta
    blobs: [
      "#FF7A2A", "#FF3A6A", "#FFC84A", "#C82AA8", "#3A0A4A",
      "#3A0A4A", "#FF7A2A", "#FF3A6A", "#C82AA8",
    ],
    line: ["#FFB02A", "#FFFFFF", "#FF5A8A"],
  },
];

export type CodeVersion = {
  id: string;
  label: string;
  /** Code text colour. */
  text: string;
  /** Channel colours used by the RGB split (the "ghost" layers). */
  channels: [string, string, string];
};

export const CODE_VERSIONS: CodeVersion[] = [
  {
    id: "MonoRGB",
    label: "2 Mono RGB",
    text: "#F0F0F0",
    channels: ["#FF0000", "#00FF00", "#0000FF"],
  },
];

export type CurtainVersion = {
  id: string;
  label: string;
  /** Colour ramp from the base of a ribbon (bottom) to its tip (top). */
  ramp: [string, string, string, string, string];
  /** Background: bottom -> top. */
  bg: [string, string];
  /** Colour of the faint glow behind the bundle. */
  glow: string;
};

export const CURTAIN_VERSIONS: CurtainVersion[] = [
  {
    id: "MagentaFire",
    label: "3A Magenta-Fire",
    ramp: ["#FFE8A0", "#FF8A2A", "#FF2A4A", "#E02AC8", "#6A2AD8"],
    bg: ["#0A0214", "#1A0430"],
    glow: "#8A1A6A",
  },
  {
    id: "BlueTeal",
    label: "3B Blue-Teal",
    ramp: ["#E8FFFF", "#2AE0F0", "#2A7AFF", "#4A3AE0", "#7A3AC8"],
    bg: ["#020A14", "#04183A"],
    glow: "#1A5AA0",
  },
];
