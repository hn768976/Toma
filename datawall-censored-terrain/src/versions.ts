import type { RGB } from "./lib/color";

// One data row per version. To add a colourway, copy a row, give it a new id and change the
// colours (and, for the terminal, the text and stamp word); then register it in Root.tsx.

// ------------------------------------------------------------------ Look 1: Data Wall
export type DataWallVersion = {
  id: string;
  background: string;
  wall: string;
  glyphDim: string;
  glyphBright: string;
  glow: string;
  line: string;
  lineOpacity: number;
  glowGain: number; // HDR multiplier for lit glow blocks (drives bloom)
  elementGain: number;
  dofStrength: number; // CoC radius (fraction of frame height) at half the focus distance
  dofMax: number; // maximum CoC radius (fraction of frame height)
  gradeGain: RGB;
  gradeLift: RGB;
};

export const DATAWALL_VERSIONS: DataWallVersion[] = [
  {
    id: "DataWall-Slate",
    background: "#05080E",
    wall: "#05080E",
    glyphDim: "#8A9AB4",
    glyphBright: "#C8D4E8",
    glow: "#D8E4F4",
    line: "#9AAAC4",
    lineOpacity: 0.3,
    glowGain: 0.85,
    elementGain: 1.0,
    dofStrength: 0.028,
    dofMax: 0.05,
    gradeGain: [0.94, 1.0, 1.08],
    gradeLift: [0.0, 0.0008, 0.002],
  },
];

// ------------------------------------------------------------------ Look 2: Censored Terminal
export type TerminalVersion = {
  id: string;
  lines: [string, string, string];
  stamp: string;
  text: string; // terminal text
  textGlow: string; // glow around text
  background: string; // screen black
  strip: string; // label strip
  stampInk: string; // stamp word colour
  fringeA: string; // background shape fringe colours
  fringeB: string;
  shapeTint: string; // tint of the blurred background shape
  gradeGain: RGB;
  gradeLift: RGB;
};

export const TERMINAL_VERSIONS: TerminalVersion[] = [
  {
    id: "CensoredTerminal-Cyan",
    lines: [
      "ONLINE CENSORSHIP RESTRICTS WHAT PEOPLE CAN READ,",
      "PUBLISH AND SHARE ON THE INTERNET. CONTENT MAY BE",
      "FILTERED, BLOCKED OR REMOVED WITHOUT NOTICE.",
    ],
    stamp: "CENSORED",
    text: "#BFF4F0",
    textGlow: "#3ADFC8",
    background: "#05090A",
    strip: "#C8EEF4",
    stampInk: "#1A2228",
    fringeA: "#5AFF8A",
    fringeB: "#8A5AFF",
    shapeTint: "#B4E0F2",
    gradeGain: [0.98, 1.0, 1.02],
    gradeLift: [0.0, 0.0006, 0.0008],
  },
  {
    id: "ClassifiedTerminal-Amber",
    lines: [
      "THIS FILE CONTAINS RESTRICTED INFORMATION. ACCESS",
      "IS LIMITED TO AUTHORISED PERSONNEL ONLY. CONTENTS",
      "ARE SUBJECT TO REVIEW AND REDACTION.",
    ],
    stamp: "CLASSIFIED",
    text: "#FFC46A",
    textGlow: "#FF8A1A",
    background: "#0A0602",
    strip: "#F4E4C8",
    stampInk: "#4A1008",
    fringeA: "#FF6A2A",
    fringeB: "#FFC84A",
    shapeTint: "#F0C898",
    gradeGain: [1.02, 1.0, 0.97],
    gradeLift: [0.0008, 0.0004, 0.0],
  },
];

// ------------------------------------------------------------------ Look 3: Particle Terrain
export type TerrainVersion = {
  id: string;
  low: string; // valley dots
  ridge: string; // ridges and slopes
  plateau: string; // plateau dots
  node: string; // nodes and vertical lines
  skyTop: string;
  skyHaze: string; // haze colour at the horizon
  hazeBand: string; // faint secondary band (warm in Blue-Ember)
  hazeBandStrength: number;
  gradeGain: RGB;
  gradeLift: RGB;
};

export const TERRAIN_VERSIONS: TerrainVersion[] = [
  {
    id: "ParticleTerrain-BlueEmber",
    low: "#3A3A9A",
    ridge: "#C86A3A",
    plateau: "#AAB8FF",
    node: "#E0E8FF",
    skyTop: "#020208",
    skyHaze: "#14143A",
    hazeBand: "#6A3A1A",
    hazeBandStrength: 0.05,
    gradeGain: [1.0, 1.0, 1.02],
    gradeLift: [0.0004, 0.0, 0.0012],
  },
  {
    id: "ParticleTerrain-Teal",
    low: "#0A4A5A",
    ridge: "#3AE0E8",
    plateau: "#AAF4F0",
    node: "#E0FFF4",
    skyTop: "#01040A",
    skyHaze: "#06142A",
    hazeBand: "#0A3A44",
    hazeBandStrength: 0.25,
    gradeGain: [0.98, 1.0, 1.0],
    gradeLift: [0.0, 0.0006, 0.001],
  },
];
