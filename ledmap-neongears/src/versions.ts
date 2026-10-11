import type { Stop } from "./lib/color";

// ---------------------------------------------------------------------------------------
// One data row per version. Root.tsx registers one composition per row.
// Gradient stops are [position, hex] with position 0 = top of the map, 1 = bottom.
// ---------------------------------------------------------------------------------------

export type LEDRow = {
  kind: "led";
  id: string;
  mode: "flat" | "glide";
  land: Stop[]; // land LED colour
  landHi: string; // highlight the colour drift moves toward
  ocean: Stop[]; // ocean LED colour
  line: Stop[]; // panel-line colour
  bg: Stop[]; // background between LEDs
  landLevel: number; // land LED brightness (0..1)
  oceanLevel: number; // ocean LED brightness
  lineLevel: number; // panel-line brightness
  modAmount: number; // scales sweep / twinkle / sparkle (1 = as specified)
  bloom: number;
  bloomThreshold: number;
  vignette: number;
  halo: number; // LED glow falloff past the LED edge, in LED cells
  haloStrength: number; // how much of the LED colour reaches the gap between LEDs
  soft: number; // extra LED edge softness in cells (1C reads as a soft, glowing panel)
  mottle: number; // static per-LED brightness spread
  gapFill: number; // land LED light caught in the gaps between land LEDs
  lineWidth: number; // panel-line half width in LED cells
  hiAmount: number; // colour drift pull toward landHi
  blurMix: number; // whole-image softening (mix toward the wide blur)
  huePreserve: number; // tonemap: 1 keeps hue on overexposure, 0 lets hot cores go white
  coastGlow: number; // land light spilling onto the ocean around the coasts
};

export type GearRow = {
  kind: "gears";
  id: string;
  lineNear: string[]; // line colours on near layers (one per gear is picked from the list)
  lineFar: string[]; // line colours on the farthest layer
  perGearMix: boolean; // true: each gear picks one colour from the list (2B)
  core: string;
  bg: string;
  haze: string;
  hazeAmt: number;
  grainFade: boolean; // fade grain to zero below ~3% luminance (black backgrounds)
  bloom: number;
  lineScale: number; // line thickness multiplier
};

export type Row = LEDRow | GearRow;

const greenAmber: Omit<LEDRow, "id" | "mode"> = {
  kind: "led",
  land: [
    [0.0, "#7AF0C8"],
    [0.42, "#C8F07A"],
    [0.72, "#FFB84A"],
    [1.0, "#FF7A2A"],
  ],
  landHi: "#D8FF60",
  ocean: [
    [0.15, "#1A4A2A"],
    [0.85, "#5A1A0A"],
  ],
  line: [
    [0.1, "#20B060"],
    [0.5, "#A0A020"],
    [0.9, "#E05010"],
  ],
  bg: [
    [0.0, "#061008"],
    [1.0, "#100604"],
  ],
  landLevel: 1.0,
  oceanLevel: 0.18,
  lineLevel: 0.65,
  modAmount: 1,
  bloom: 0.9,
  bloomThreshold: 0.35,
  vignette: 0.25,
  halo: 0.07,
  haloStrength: 0.35,
  soft: 0.04,
  mottle: 0.25,
  gapFill: 0.18,
  lineWidth: 0.14,
  hiAmount: 0.1,
  blurMix: 0.2,
  huePreserve: 0.45,
  coastGlow: 0.18,
};

export const ROWS: Row[] = [
  { ...greenAmber, id: "LEDWorldMap-GreenAmber", mode: "flat" },
  {
    kind: "led",
    id: "LEDWorldMap-Ember",
    mode: "flat",
    land: [[0, "#FFA03A"]],
    landHi: "#FFC870",
    ocean: [[0, "#6A1A08"]],
    line: [[0, "#C8400E"]],
    bg: [[0, "#1A0402"]],
    // The Ember reference lights the whole panel: ocean LEDs glow a mid red-orange.
    landLevel: 1.05,
    oceanLevel: 2.2,
    lineLevel: 0.9,
    modAmount: 1,
    bloom: 0.8,
    bloomThreshold: 0.45,
    vignette: 0.3,
    halo: 0.07,
    haloStrength: 0.35,
    soft: 0.04,
    mottle: 0.45,
    gapFill: 0.18,
    lineWidth: 0.12,
    hiAmount: 0.12,
    blurMix: 0.2,
    huePreserve: 0.45,
    coastGlow: 0.15,
  },
  {
    kind: "led",
    id: "LEDWorldMap-SkyBlue",
    mode: "flat",
    land: [[0, "#1A6ADA"]],
    landHi: "#3A8AF0",
    ocean: [[0, "#C8F4FF"]],
    line: [[0, "#6AC8F0"]],
    bg: [[0, "#E8FAFF"]],
    landLevel: 0.62,
    oceanLevel: 1,
    lineLevel: 1,
    modAmount: 0.5,
    // light background: no additive bloom (it would wash to white); a soft blur mix instead
    bloom: 0,
    bloomThreshold: 0,
    vignette: 0.06,
    halo: 0.22,
    haloStrength: 0.75,
    soft: 0.1,
    mottle: 0.15,
    gapFill: 1.0,
    lineWidth: 0.2,
    hiAmount: 0.15,
    blurMix: 0.4,
    huePreserve: 0.85,
    coastGlow: 0.35,
  },
  { ...greenAmber, id: "LEDWorldMap-PanelGlide", mode: "glide" },
  {
    kind: "gears",
    id: "NeonGears-Fire",
    lineNear: ["#FF6A2A"],
    lineFar: ["#E83A1A"],
    perGearMix: false,
    core: "#FFE8A0",
    bg: "#000000",
    haze: "#1A0602",
    hazeAmt: 1,
    grainFade: true,
    bloom: 0.5,
    lineScale: 1,
  },
  {
    kind: "gears",
    id: "NeonGears-CyanViolet",
    // order: top-right, bottom-right, top-left, bottom-left (each gear picks by position,
    // with some random mixing, giving the reference's diagonal colour drift)
    lineNear: ["#5AF0E8", "#3AE8A8", "#9A6AFF", "#E84AE8"],
    lineFar: ["#5AF0E8", "#3AE8A8", "#9A6AFF", "#E84AE8"],
    perGearMix: true,
    core: "#F4FAFF",
    bg: "#0A0628",
    haze: "#2A1A6A",
    hazeAmt: 0.15,
    grainFade: false,
    bloom: 0.5,
    lineScale: 1.15,
  },
  {
    kind: "gears",
    id: "NeonGears-Brass",
    lineNear: ["#E8B04A"],
    lineFar: ["#B8702A"],
    perGearMix: false,
    core: "#FFF0C0",
    bg: "#000000",
    haze: "#140A02",
    hazeAmt: 1,
    grainFade: true,
    bloom: 0.5,
    lineScale: 1,
  },
];
