// Composition timing: the reference clip is 500 frames at 30 fps = 16.667 s.
export const FPS = 30;
export const DURATION_IN_FRAMES = 500;

// Master compositions are authored in UHD 4K.
export const WIDTH = 3840;
export const HEIGHT = 2160;

export type Variant = "reference" | "blueprint";

export type Palette = {
  /** Radial background: [bright hotspot, mid, outer edge] */
  background: [string, string, string];
  /** Hotspot position in normalised screen space (0..1, y down). */
  hotspot: [number, number];
  /** Translucent glass face tint. */
  face: string;
  /** Opacity of a single glass face. */
  faceAlpha: number;
  /** Cube edge colour + opacity. */
  edge: string;
  edgeAlpha: number;
  /** Colour of the printed data / text on the faces. */
  ink: string;
  inkAlpha: number;
  /** Colour of the wave-graph networks. */
  wave: string;
  waveAlpha: number;
  /** Fog colour that distant geometry fades into (matches the background). */
  fog: string;
  additive: boolean;
};

export const PALETTES: Record<Variant, Palette> = {
  // Version 1: matches the reference — bright studio-white void,
  // smoky grey glass cubes, graphite edges and print.
  reference: {
    background: ["#f7f7f6", "#d6d6d5", "#a3a29f"],
    hotspot: [0.5, 0.32],
    face: "#5b5b5d",
    faceAlpha: 0.08,
    edge: "#2e2e30",
    edgeAlpha: 0.62,
    ink: "#2a2a2c",
    inkAlpha: 0.6,
    wave: "#1c1c1e",
    waveAlpha: 0.9,
    fog: "#e0e0df",
    additive: false,
  },
  // Version 2: same scene and camera, re-lit as a dark holographic blueprint —
  // deep navy void, additive cyan glass and warm amber data waves.
  blueprint: {
    background: ["#1b4f7a", "#0a2340", "#020711"],
    hotspot: [0.5, 0.3],
    face: "#2c9fe0",
    faceAlpha: 0.05,
    edge: "#7fe6ff",
    edgeAlpha: 0.85,
    ink: "#a8f1ff",
    inkAlpha: 0.9,
    wave: "#ffb24a",
    waveAlpha: 0.95,
    fog: "#0a2340",
    additive: true,
  },
};
