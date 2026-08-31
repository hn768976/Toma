/**
 * Every colour and every per-version parameter of the piece lives here.
 * No hex literal appears anywhere else in the wave-field source.
 */

export const VARIANT_NAMES = ["blue", "violet", "mono"] as const;

export type VariantName = (typeof VARIANT_NAMES)[number];

export type MeshMode = "sparse" | "dense" | "none";

export interface ParticleTone {
  /** Hex colour, taken from the variant palette. */
  color: string;
  /** Relative share of the particle field. Weights need not sum to 1. */
  weight: number;
}

export interface Palette {
  backgroundDeep: string;
  backgroundWash: string;
  meshLine: string;
  /** The leading-edge dots. */
  edgeAccent: string;
  /** The hot cores of the leading-edge dots, and their outer glow. */
  edgeCore: string;
  /** Tint of the faint surface strands that make a band read as a surface. */
  strand: string;
  /** Mixed particle hues: accent dominant, cooler and warmer variants through it. */
  particleTones: ParticleTone[];
}

export interface Harmonic {
  /**
   * Whole number of crests across BAND_LENGTH. Integer so the surface is
   * periodic along the band and drifting particles wrap seamlessly.
   */
  spatial: number;
  /**
   * Whole number of cycles the wave travels in 450 frames. Integer so the
   * phase returns exactly to its start at frame 450.
   */
  temporal: number;
  /** Amplitude at the band's lower fringe, in 4K pixels. */
  amp: number;
  /** Fixed phase offset, in turns. */
  phase: number;
}

export interface VariantConfig {
  palette: Palette;
  /** How strongly the background wash lifts off the deep tone, 0 to 1. */
  washStrength: number;

  /** Number of parallel bands stacked across the frame. */
  bandCount: number;
  /** Perpendicular distance between one band's leading edge and the next. */
  bandPitch: number;
  /** How far a band's surface hangs below its leading edge. */
  bandThickness: number;
  /** Iso-depth strands drawn per band to render the surface. */
  strandRows: number;
  strandAlpha: number;

  /** Total particles across all bands. */
  particleCount: number;
  particleLength: [number, number];
  particleWidth: [number, number];
  particleAlpha: [number, number];

  /** Leading-edge dots: uniform size and uniform spacing within a band. */
  dotSpacing: number;
  dotRadius: number;
  /** Crests of the travelling brightness pulse present along a band at once. */
  pulseCrests: number;
  /** Whole cycles the pulse travels in 450 frames, so its period divides 450. */
  pulseTravel: number;
  /** Higher values make the pulse a tighter, more pronounced bright wave. */
  pulseSharpness: number;

  meshMode: MeshMode;
  meshCount: number;
  meshAlpha: number;

  harmonics: Harmonic[];
  /** Per-band extra whole cycles per 450 frames, so bands never move in lockstep. */
  bandRateOffsets: number[];
  /** Nearest and farthest band scale, driving particle size and dot size. */
  depthScale: [number, number];
}

// --- v1 "blue": warm particles, cool ground -------------------------------

const BLUE_BACKGROUND_DEEP = "#060E33";
const BLUE_BACKGROUND_WASH = "#10205C";
const BLUE_MESH_LINE = "#1A2E6B";
const BLUE_EDGE_CYAN = "#4FD4F5";
const BLUE_EDGE_WHITE = "#E8FAFF";
const BLUE_PARTICLE_AMBER = "#F5A03F";
const BLUE_PARTICLE_ORANGE = "#E8763F";
const BLUE_PARTICLE_VIOLET = "#7B5FE8";
const BLUE_PARTICLE_PALE = "#F5D8A8";

// --- v2 "violet": cool particles, warm ground -----------------------------

const VIOLET_BACKGROUND_DEEP = "#14062E";
const VIOLET_BACKGROUND_WASH = "#2E1258";
const VIOLET_MESH_LINE = "#3A1A6B";
const VIOLET_EDGE_MAGENTA = "#F55FD4";
const VIOLET_EDGE_WHITE = "#FFF0FA";
const VIOLET_PARTICLE_MINT = "#4FE8A8";
const VIOLET_PARTICLE_TEAL = "#2E9FB8";
const VIOLET_PARTICLE_GOLD = "#F5C43F";
const VIOLET_PARTICLE_PALE = "#C4FFE4";

// --- v3 "mono": no colour at all ------------------------------------------

const MONO_BACKGROUND_DEEP = "#050508";
const MONO_BACKGROUND_WASH = "#12141A";
const MONO_MESH_LINE = "#1E2028";
const MONO_EDGE_WHITE = "#FFFFFF";
const MONO_EDGE_PALE = "#E0E4EA";
const MONO_PARTICLE_PALE = "#B0B8C4";
const MONO_PARTICLE_MID = "#6A7280";
const MONO_PARTICLE_BRIGHT = "#F0F4F8";
const MONO_PARTICLE_DIM = "#3A4048";

export const VARIANTS: Record<VariantName, VariantConfig> = {
  blue: {
    palette: {
      backgroundDeep: BLUE_BACKGROUND_DEEP,
      backgroundWash: BLUE_BACKGROUND_WASH,
      meshLine: BLUE_MESH_LINE,
      edgeAccent: BLUE_EDGE_CYAN,
      edgeCore: BLUE_EDGE_WHITE,
      strand: BLUE_EDGE_CYAN,
      particleTones: [
        { color: BLUE_PARTICLE_AMBER, weight: 0.46 },
        { color: BLUE_PARTICLE_ORANGE, weight: 0.22 },
        { color: BLUE_PARTICLE_VIOLET, weight: 0.16 },
        { color: BLUE_PARTICLE_PALE, weight: 0.16 },
      ],
    },
    washStrength: 1,
    bandCount: 4,
    bandPitch: 565,
    bandThickness: 285,
    strandRows: 34,
    strandAlpha: 0.34,
    particleCount: 9000,
    particleLength: [26, 78],
    particleWidth: [3.6, 6.5],
    particleAlpha: [0.18, 0.95],
    dotSpacing: 66,
    dotRadius: 16,
    pulseCrests: 2,
    pulseTravel: 3,
    pulseSharpness: 6,
    meshMode: "sparse",
    meshCount: 14,
    meshAlpha: 0.5,
    harmonics: [
      { spatial: 6, temporal: 3, amp: 88, phase: 0 },
      { spatial: 11, temporal: -2, amp: 32, phase: 0.31 },
      { spatial: 17, temporal: 4, amp: 14, phase: 0.67 },
    ],
    bandRateOffsets: [0, 1, -1, 2],
    depthScale: [0.62, 1.18],
  },

  violet: {
    palette: {
      backgroundDeep: VIOLET_BACKGROUND_DEEP,
      backgroundWash: VIOLET_BACKGROUND_WASH,
      meshLine: VIOLET_MESH_LINE,
      edgeAccent: VIOLET_EDGE_MAGENTA,
      edgeCore: VIOLET_EDGE_WHITE,
      // Teal, not the pale mint: a near-white strand greys out the mint field.
      strand: VIOLET_PARTICLE_TEAL,
      particleTones: [
        { color: VIOLET_PARTICLE_MINT, weight: 0.46 },
        { color: VIOLET_PARTICLE_TEAL, weight: 0.22 },
        { color: VIOLET_PARTICLE_GOLD, weight: 0.16 },
        { color: VIOLET_PARTICLE_PALE, weight: 0.16 },
      ],
    },
    // The violet wash sits far closer to its particles in luminance than the
    // blue one does, so it is held back to keep the mint field reading.
    washStrength: 0.7,
    // Narrower bands at tighter spacing than v1: 7 across the frame where v1
    // had 4, so the frame reads as busier and more layered.
    bandCount: 7,
    bandPitch: 320,
    bandThickness: 165,
    strandRows: 18,
    strandAlpha: 0.13,
    // More particles at smaller scale: count up, size down ~25%, alpha down
    // ~20%, so the field reads finer-grained rather than merely busier.
    particleCount: 15000,
    particleLength: [20, 58],
    particleWidth: [2.7, 4.9],
    particleAlpha: [0.14, 0.76],
    dotSpacing: 52,
    dotRadius: 11,
    pulseCrests: 3,
    pulseTravel: 5,
    pulseSharpness: 6,
    // Roughly double v1's curve count at lower opacity each.
    meshMode: "dense",
    meshCount: 28,
    meshAlpha: 0.32,
    // Shorter wavelength and higher frequency than v1, so each band carries
    // more crests; amplitude drops so the narrower bands do not overlap.
    harmonics: [
      { spatial: 11, temporal: 4, amp: 52, phase: 0 },
      { spatial: 19, temporal: -3, amp: 19, phase: 0.4 },
      { spatial: 29, temporal: 5, amp: 8, phase: 0.75 },
    ],
    bandRateOffsets: [0, 1, -1, 2, -2, 3, 1],
    depthScale: [0.62, 1.12],
  },

  mono: {
    palette: {
      backgroundDeep: MONO_BACKGROUND_DEEP,
      backgroundWash: MONO_BACKGROUND_WASH,
      meshLine: MONO_MESH_LINE,
      edgeAccent: MONO_EDGE_WHITE,
      edgeCore: MONO_EDGE_PALE,
      strand: MONO_PARTICLE_PALE,
      particleTones: [
        { color: MONO_PARTICLE_PALE, weight: 0.44 },
        { color: MONO_PARTICLE_MID, weight: 0.26 },
        { color: MONO_PARTICLE_BRIGHT, weight: 0.14 },
        { color: MONO_PARTICLE_DIM, weight: 0.16 },
      ],
    },
    washStrength: 1,
    // Two bands instead of seven, each roughly 40% of frame height. The
    // negative space between and around them is a major element here.
    bandCount: 2,
    bandPitch: 1250,
    bandThickness: 900,
    strandRows: 40,
    strandAlpha: 0.28,
    // Fewer particles at roughly double v1's size and far more varied in
    // length, so each one is individually visible. With no colour to carry
    // variety, size and length have to.
    particleCount: 4000,
    particleLength: [55, 230],
    particleWidth: [7.2, 13],
    particleAlpha: [0.2, 1],
    // Larger and more widely spaced than v1, with a far more pronounced
    // travelling pulse. With no colour and few elements, this is the main event.
    dotSpacing: 130,
    dotRadius: 30,
    pulseCrests: 1,
    pulseTravel: 2,
    pulseSharpness: 11,
    meshMode: "none",
    meshCount: 0,
    meshAlpha: 0,
    // Much higher amplitude and much longer wavelength than v1: one or two
    // large sweeping swells across the frame rather than many small ones, so
    // the wave is the frame's dominant shape rather than a texture within it.
    harmonics: [
      { spatial: 2, temporal: 2, amp: 330, phase: 0 },
      { spatial: 3, temporal: -1, amp: 120, phase: 0.37 },
      { spatial: 5, temporal: 3, amp: 52, phase: 0.8 },
    ],
    bandRateOffsets: [0, 1],
    depthScale: [0.8, 1.05],
  },
};
