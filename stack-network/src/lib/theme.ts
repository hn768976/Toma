import { BOARD_HEIGHT, BOARD_WIDTH } from "./constants";
import { between, makeRandom, type Random } from "./random";

/** One heavily defocused background shape. */
export type Bokeh = {
  x: number;
  y: number;
  radius: number;
  color: string;
  opacity: number;
  /** Softness of the falloff: 1 is a gaussian smudge, 0 a crisp disc. */
  softness: number;
  driftCycles: number;
  driftPhase: number;
  driftRadius: number;
};

/** How the plane is tilted into the frame. */
export type BoardTransform = {
  perspective: number;
  rotateX: number;
  rotateY: number;
  rotateZ: number;
  /** Extra zoom on top of the fit-to-frame scale. */
  zoom: number;
  translateX: number;
  translateY: number;
};

export type Theme = {
  id: string;
  /** Flat colour painted under everything, so nothing shows through. */
  base: string;
  /** Layered radial/linear gradients, painted back to front. */
  washes: string[];
  bokeh: Bokeh[];
  board: BoardTransform;
  /** Connector stroke and the dots riding it. */
  dash: string;
  dashSoft: string;
  /** Text inside label nodes. */
  labelText: string;
  hero: string;
  heroGlow: string;
  /** Ring and glyph colours for icon nodes. */
  iconRing: string;
  iconGlyph: string;
  iconAccent: string;
  /** Oversized blurred word sitting behind the network. */
  ghost: { text: string; color: string; x: number; y: number; size: number; rotate: number; blur: number };
  vignette: string;
  grainOpacity: number;
};

/**
 * Scatters the defocused background shapes. Seeded and called once at
 * module scope, so every render thread lays them out identically.
 */
const makeBokeh = (
  rng: Random,
  count: number,
  colors: string[],
  radius: [number, number],
  opacity: [number, number],
): Bokeh[] =>
  Array.from({ length: count }, (_, i) => ({
    x: between(rng, -0.15, 1.15) * BOARD_WIDTH,
    y: between(rng, -0.15, 1.15) * BOARD_HEIGHT,
    radius: between(rng, radius[0], radius[1]),
    color: colors[i % colors.length],
    opacity: between(rng, opacity[0], opacity[1]),
    softness: between(rng, 0.35, 0.95),
    // Whole numbers of cycles, so the drift returns to its start.
    driftCycles: 1 + (i % 2),
    driftPhase: rng(),
    driftRadius: between(rng, 40, 150),
  }));

/**
 * V1 -- warm.
 *
 * Near-black brown field, a broad amber glow off the upper right, and
 * deep red shapes low and left.
 */
export const warmTheme: Theme = {
  id: "warm",
  base: "#120a09",
  washes: [
    // Amber key light, upper right.
    "radial-gradient(62% 66% at 86% 2%, rgba(212,120,40,0.7) 0%, rgba(158,72,24,0.34) 40%, rgba(26,14,8,0) 78%)",
    // Warmth lifting the middle of the plane off the black.
    "radial-gradient(78% 86% at 58% 40%, rgba(140,58,28,0.46) 0%, rgba(26,14,8,0) 72%)",
    // Deep red pooling bottom left.
    "radial-gradient(58% 58% at 14% 82%, rgba(112,28,22,0.46) 0%, rgba(20,10,10,0) 72%)",
    // Cold shoulder so the warm side has something to read against.
    "radial-gradient(60% 60% at 6% 20%, rgba(28,26,58,0.5) 0%, rgba(18,12,14,0) 72%)",
    "linear-gradient(155deg, rgba(10,8,14,0.6) 0%, rgba(26,14,8,0) 46%, rgba(12,6,6,0.45) 100%)",
  ],
  bokeh: makeBokeh(
    makeRandom(0x5ea17),
    14,
    ["#c46a20", "#8c2417", "#3a2b6a", "#d8853a", "#5d1a14"],
    [420, 1150],
    [0.14, 0.36],
  ),
  board: {
    perspective: 5200,
    rotateX: 19,
    rotateY: -21,
    rotateZ: -7,
    zoom: 1.03,
    translateX: -60,
    translateY: 40,
  },
  dash: "#2fd2f8",
  dashSoft: "#1b8fb5",
  labelText: "#f4f1ee",
  hero: "#3f9ff2",
  heroGlow: "rgba(63,159,242,0.55)",
  iconRing: "#6d4034",
  iconGlyph: "#c8a08c",
  iconAccent: "#c2703f",
  ghost: {
    text: "</>",
    color: "rgba(224,164,120,0.17)",
    x: 0.52,
    y: 0.2,
    size: 1500,
    rotate: -6,
    blur: 26,
  },
  vignette:
    "radial-gradient(78% 74% at 50% 46%, rgba(0,0,0,0) 42%, rgba(0,0,0,0.42) 78%, rgba(0,0,0,0.78) 100%)",
  grainOpacity: 0.015,
};

/**
 * V2 -- violet.
 *
 * Deep indigo-to-purple field with a blue lift top left and magenta
 * bleeding in from the right.
 */
export const violetTheme: Theme = {
  id: "violet",
  base: "#140828",
  washes: [
    "radial-gradient(62% 68% at 30% 22%, rgba(58,86,168,0.55) 0%, rgba(42,16,80,0.22) 46%, rgba(20,8,40,0) 76%)",
    "radial-gradient(58% 62% at 66% 46%, rgba(74,34,128,0.52) 0%, rgba(20,8,40,0) 70%)",
    "radial-gradient(52% 58% at 96% 30%, rgba(138,42,134,0.36) 0%, rgba(20,8,40,0) 68%)",
    "radial-gradient(60% 60% at 8% 92%, rgba(52,20,96,0.5) 0%, rgba(16,6,32,0) 72%)",
    "linear-gradient(160deg, rgba(24,12,52,0.5) 0%, rgba(42,16,80,0) 45%, rgba(12,4,24,0.72) 100%)",
  ],
  bokeh: makeBokeh(
    makeRandom(0x1071e7),
    15,
    ["#3f6ac8", "#8a2a86", "#5a2ea8", "#2f4fa0", "#a03a92"],
    [400, 1180],
    [0.1, 0.28],
  ),
  board: {
    perspective: 5000,
    rotateX: 15,
    rotateY: 17,
    rotateZ: 5,
    zoom: 1.0,
    translateX: 40,
    translateY: 10,
  },
  dash: "#31dcea",
  dashSoft: "#1d93ad",
  labelText: "#eef6ff",
  hero: "#2ae8fb",
  heroGlow: "rgba(42,232,251,0.5)",
  iconRing: "#e8862a",
  iconGlyph: "#f0a24a",
  iconAccent: "#2fc4d8",
  ghost: {
    text: "CODE",
    color: "rgba(150,180,255,0.09)",
    x: 0.44,
    y: 0.62,
    size: 1180,
    rotate: -8,
    blur: 30,
  },
  vignette:
    "radial-gradient(76% 72% at 48% 48%, rgba(0,0,0,0) 40%, rgba(6,2,16,0.42) 76%, rgba(4,1,12,0.8) 100%)",
  grainOpacity: 0.015,
};
