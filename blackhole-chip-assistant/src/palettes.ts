/**
 * ─── EDIT COLOURS HERE ──────────────────────────────────────────────────────
 * Every colour in the six compositions comes from this file.
 * 3D looks (1, 2): colours are linear-light RGB triples, 0..1 (values above 1
 * are allowed for HDR glow and are what the bloom picks up).
 * 2D look (3): CSS colour strings.
 */

export type RGB = [number, number, number];

export type BlackHolePalette = {
  /** deep space background */
  space: RGB;
  /** disc colour ramp, centre -> edge */
  core: RGB;
  inner: RGB;
  mid: RGB;
  outer: RGB;
  /** jet beam */
  jet: RGB;
  /** star tint */
  star: RGB;
};

export const BLACK_HOLE_PALETTES = {
  blue: {
    space: [0.006, 0.011, 0.034],
    core: [1.0, 1.0, 1.0],
    inner: [0.62, 0.78, 1.0],
    mid: [0.2, 0.34, 0.68],
    outer: [0.05, 0.09, 0.22],
    jet: [0.72, 0.84, 1.0],
    star: [0.75, 0.85, 1.0],
  },
  gold: {
    space: [0.0045, 0.007, 0.024],
    core: [1.0, 0.78, 0.42],
    inner: [1.0, 0.52, 0.04],
    mid: [1.0, 0.2, 0.0],
    outer: [0.8, 0.012, 0.0],
    jet: [1.0, 0.9, 0.7],
    star: [1.0, 0.92, 0.8],
  },
} satisfies Record<string, BlackHolePalette>;

export type ChipPalette = {
  /** board under the chip */
  board: RGB;
  /** glow the chip throws onto the board */
  boardGlow: RGB;
  /** unlit memory cells */
  cellDim: RGB;
  /** cell frame lines / inner detail */
  cellLine: RGB;
  /** lit (twinkling) cells — HDR */
  cellLit: RGB;
  /** inner glass grid layer */
  innerGrid: RGB;
  /** edge glow (fresnel) */
  edge: RGB;
  /** circuit trace base colour */
  trace: RGB;
  /** pulse travelling along a trace — HDR */
  pulse: RGB;
  /** electric filaments and sparks — HDR */
  spark: RGB;
  /** background beyond the board */
  background: RGB;
};

export const CHIP_PALETTES = {
  blue: {
    board: [0.004, 0.006, 0.012],
    boardGlow: [0.05, 0.16, 0.6],
    cellDim: [0.035, 0.05, 0.26],
    cellLine: [0.07, 0.13, 0.5],
    cellLit: [3.2, 3.6, 4.4],
    innerGrid: [0.06, 0.16, 0.6],
    edge: [0.3, 0.6, 1.6],
    trace: [0.08, 0.35, 1.2],
    pulse: [2.6, 4.2, 7.0],
    spark: [1.8, 3.4, 7.0],
    background: [0.002, 0.003, 0.008],
  },
  gold: {
    board: [0.008, 0.004, 0.0015],
    boardGlow: [0.28, 0.11, 0.012],
    cellDim: [0.075, 0.032, 0.005],
    cellLine: [0.2, 0.09, 0.012],
    cellLit: [4.4, 3.8, 2.6],
    innerGrid: [0.2, 0.08, 0.01],
    edge: [0.9, 0.45, 0.08],
    trace: [0.6, 0.25, 0.025],
    pulse: [6.0, 4.8, 2.6],
    spark: [6.0, 4.0, 1.4],
    background: [0.006, 0.003, 0.001],
  },
} satisfies Record<string, ChipPalette>;

export type AssistantPalette = {
  /** screen background: a gradient from -> to across the screen */
  screenFrom: string;
  screenTo: string;
  /** neon outlines */
  line: string;
  /** glow around outlines and text */
  glow: string;
  /** text */
  text: string;
  /** dot-grid strength (0..1); higher = more visible pixel pattern */
  dotStrength: number;
  /** colour of the bright pixel dots */
  dot: string;
  /** the dark area around the screen (bezel) */
  bezel: string;
};

export const ASSISTANT_PALETTES = {
  neon: {
    screenFrom: "#5b1fe0",
    screenTo: "#1f5ff0",
    line: "#f4e8ff",
    glow: "#c9a6ff",
    text: "#fff4fb",
    dotStrength: 0.34,
    dot: "#b9c8ff",
    bezel: "#12083a",
  },
  terminal: {
    screenFrom: "#020a04",
    screenTo: "#041208",
    line: "#7dffa0",
    glow: "#1fdc55",
    text: "#72ff94",
    dotStrength: 0.5,
    dot: "#2fa34f",
    bezel: "#000000",
  },
} satisfies Record<string, AssistantPalette>;

/**
 * ─── EDIT CHAT TEXT HERE ────────────────────────────────────────────────────
 * Timings (frames, 30 fps) are in src/assistant/script.ts. If you make the
 * text much longer, give the typing more frames there.
 */
export const CHAT_TEXT = {
  title: "AI Assistant",
  question: "Can you help me?",
  reply: "Sure, I will help you — just tell me what you need.",
};
