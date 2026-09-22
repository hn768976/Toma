import { CatmullRomCurve3 } from "three";
import { CELL_H, CELL_W, COLS, ROWS } from "./digitField";
import { BandSpec, makeBandCurve, makeCableCurve } from "./geometry";
import { mulberry32 } from "./random";

/**
 * Wrap a scroll offset into [0, 1).
 *
 * The digit texture and the glow mask are both periodic with period 1, so
 * adding an integer number of periods is mathematically a no-op -- but
 * `uv * repeat + 3.0` and `uv * repeat + 0.0` are not the same float, and the
 * texture samples land a fraction of a texel apart. Wrapping here makes frame
 * 600 bit-identical to frame 0 instead of merely indistinguishable, and it
 * still fails loudly if a scroll count is ever given a non-integer value.
 */
export const wrap01 = (x: number) => x - Math.floor(x);

export const FPS = 30;
export const DURATION = 600; // 20s -- a data stream earns its length
export const WIDTH = 3840;
export const HEIGHT = 2160;

export type Palette = {
  base: string;
  glow: string;
  rim: string;
  /** Bloom tint for the ground reflection and bokeh. */
  accent: string;
};

/**
 * Lit pixels in the references average close to (7, 97, 218) -- effectively no
 * red at all. A near-white glow put mean red near 60 and the whole thing read
 * as washed periwinkle, so the digits are tinted toward cyan and let bloom,
 * not the base colour, carry them to white.
 */
export const BLUE: Palette = {
  base: "#0a3ad2",
  glow: "#4fd8ff",
  rim: "#2f9cff",
  accent: "#2f8fff",
};
export const GREEN: Palette = {
  base: "#067a33",
  glow: "#3dffa4",
  rim: "#1fff84",
  accent: "#1fd06e",
};
export const AMBER: Palette = {
  base: "#c86a0a",
  glow: "#ffb347",
  rim: "#ffb04d",
  accent: "#ff9426",
};

export type StrandDef = {
  kind: "ribbon" | "cable";
  curve: CatmullRomCurve3;
  /** Ribbon: chord width. Cable: radius. */
  size: number;
  /** Ribbon only: degrees of cylindrical curvature across the width. */
  arcDeg: number;
  repeatU: number;
  repeatV: number;
  /** Integer texture repeats scrolled over the loop. Varying this per strand
   *  is what makes the cables flow at visibly different speeds. */
  scrollRepeats: number;
  maskPeriods: number;
  maskRepeats: number;
  maskDepth: number;
  intensity: number;
  collarCount: number;
  segsU: number;
  segsV: number;
};

/**
 * Work out the texture repeats that keep a character square-ish on the
 * surface, then round the length repeat to an integer so collar spacing can be
 * an exact divisor of it.
 */
const repeatsFor = (
  curveLength: number,
  crossWidth: number,
  rowsAcross: number,
) => {
  const charH = crossWidth / rowsAcross;
  const charW = charH * (CELL_W / CELL_H);
  const repeatU = Math.max(1, Math.round(curveLength / (charW * COLS)));
  return { repeatU, repeatV: rowsAcross / ROWS };
};

/* ------------------------------------------------------------------ *
 * Look 1 -- Data Ribbons
 * ------------------------------------------------------------------ */

export type BandRow = BandSpec & {
  width: number;
  rowsAcross: number;
  scrollRepeats: number;
};

const buildRibbons = (rows: readonly BandRow[]): StrandDef[] =>
  rows.map((row) => {
    const curve = makeBandCurve(row);
    const length = curve.getLength();
    const { repeatU, repeatV } = repeatsFor(length, row.width, row.rowsAcross);
    return {
      kind: "ribbon" as const,
      curve,
      size: row.width,
      arcDeg: 60,
      repeatU,
      repeatV,
      scrollRepeats: row.scrollRepeats,
      maskPeriods: 1,
      maskRepeats: 0,
      maskDepth: 0, // ribbons glow along their whole length
      intensity: 1,
      collarCount: 0,
      segsU: 224,
      segsV: 24,
    };
  });

/* ------------------------------------------------------------------ *
 * Look 2 -- Cable Bundle
 * ------------------------------------------------------------------ */

export type RackOptions = {
  count: number;
  spacing: number;
  radius: number;
  halfLength: number;
  zStart: number;
  y: number;
  sag: number;
  /** Index past which cables are unlit dark bodies -- the back of the rack. */
  litCount: number;
  collarCount: number;
  withCollars: boolean;
};

const rackRng = mulberry32(0x0bada55);
/** Drawn once, at module level: one integer scroll rate per rack slot. */
const RACK_SCROLLS = Array.from({ length: 64 }, () =>
  [1, 2, 3][Math.floor(rackRng() * 3) % 3],
);
const RACK_MASK_SCROLLS = Array.from({ length: 64 }, () =>
  [1, 1, 2][Math.floor(rackRng() * 3) % 3],
);

const buildRack = (o: RackOptions): StrandDef[] => {
  const defs: StrandDef[] = [];
  for (let i = 0; i < o.count; i++) {
    const z = o.zStart - i * o.spacing;
    const curve = makeCableCurve({
      from: [-o.halfLength, o.y, z],
      to: [o.halfLength, o.y, z],
      sag: o.sag,
    });
    const circumference = 2 * Math.PI * o.radius;
    // repeatV must stay an integer: the cylinder is closed, and a fractional
    // repeat seams visibly round the back.
    const { repeatU, repeatV } = repeatsFor(curve.getLength(), circumference, ROWS);

    // Collars must divide the UV repeat exactly or they drift against the
    // digits and the 600-frame loop stops closing.
    const collarCount = o.withCollars
      ? [...Array(repeatU).keys()]
          .map((n) => n + 1)
          .filter((n) => repeatU % n === 0)
          .reduce((best, n) =>
            Math.abs(n - o.collarCount) < Math.abs(best - o.collarCount) ? n : best,
          )
      : 0;

    const fade =
      i < o.litCount ? 1 : Math.max(0, 1 - (i - o.litCount + 1) / 4);

    defs.push({
      kind: "cable",
      curve,
      size: o.radius,
      arcDeg: 0,
      repeatU,
      repeatV,
      scrollRepeats: RACK_SCROLLS[i % RACK_SCROLLS.length],
      maskPeriods: collarCount || 8,
      maskRepeats: RACK_MASK_SCROLLS[i % RACK_MASK_SCROLLS.length],
      maskDepth: o.withCollars ? 0.92 : 0.45,
      intensity: fade,
      collarCount,
      segsU: 204,
      segsV: 32,
    });
  }
  return defs;
};

/* ------------------------------------------------------------------ *
 * Compositions
 * ------------------------------------------------------------------ */

export type BokehConfig = {
  count: number;
  spread: [number, number];
  z: [number, number];
  radius: [number, number];
};

/**
 * The "reflective ground" is a mirrored, dimmed copy of the cables rather than
 * a mirror material. The references show a soft, broken reflection, and a
 * mirrored copy sits further from the camera so the depth of field softens it
 * for free -- which is both cheaper and closer to the look than a real mirror.
 */
export type GroundConfig = {
  y: number;
  intensity: number;
  /** Extra downward fade so the reflection dies away from the cables. */
  fade: number;
};

export type LookConfig = {
  id: string;
  outName: string;
  palette: Palette;
  strands: StrandDef[];
  camera: {
    position: [number, number, number];
    lookAt: [number, number, number];
    fov: number;
  };
  dof: {
    worldFocusDistance: number;
    worldFocusRange: number;
    bokehScale: number;
  };
  bloom: { threshold: number; smoothing: number; intensity: number; radius: number };
  shading: {
    baseIntensity: number;
    digitIntensity: number;
    rimIntensity: number;
    rimPower: number;
    maskSoftness: number;
    /** How strongly the cross-section normal shades the surface. */
    shadeAmount: number;
    /** >0 lengthens the lit runs relative to the dark ones. */
    maskBias: number;
  };
  bokeh: BokehConfig | null;
  ground: GroundConfig | null;
  /** True only where the frame really is #000000 away from the strands. */
  pureBlack: boolean;
  stillFrames: [number, number, number];
};

const RIBBON_CAMERA = {
  position: [0, 0, 18] as [number, number, number],
  lookAt: [0, 0, 0] as [number, number, number],
  fov: 32,
};

/**
 * Exposure is tuned against the bloom threshold, not by eye in isolation.
 * Typical digits must land below the threshold and only the hot ones above it,
 * otherwise the whole strand blooms and the digits stop being readable.
 */
const RIBBON_SHADING = {
  baseIntensity: 0.45,
  digitIntensity: 7.4,
  rimIntensity: 1.5,
  rimPower: 1.9,
  maskSoftness: 0.16,
  shadeAmount: 0.8,
  maskBias: 0,
};

const CABLE_SHADING = {
  baseIntensity: 0.38,
  digitIntensity: 7.0,
  rimIntensity: 1.5,
  rimPower: 2.8,
  maskSoftness: 0.05,
  shadeAmount: 0.92,
  maskBias: 0.12,
};

/* --- 1A: gentle S-curves with a bokeh field ----------------------- */
const BANDS_1A: BandRow[] = [
  // As in 1C, the sharp band is held nearly flat in depth so the focal plane
  // can keep a long readable stretch of digits.
  { angleDeg: -7, length: 46, center: [0.0, -1.2, 4.6], bow: 1.6, zBow: 0.5, zTilt: -0.8, width: 1.45, rowsAcross: 12, scrollRepeats: 2 },
  { angleDeg: 11, length: 48, center: [1.8, 4.8, -3.0], bow: -2.6, zBow: 2.0, zTilt: 4, width: 2.0, rowsAcross: 13, scrollRepeats: 3 },
  { angleDeg: -19, length: 50, center: [-5.2, -5.4, -1.6], bow: 2.2, zBow: -1.2, zTilt: 2.5, width: 1.75, rowsAcross: 12, scrollRepeats: 1 },
  { angleDeg: 5, length: 54, center: [0.8, 7.4, -10.0], bow: 3.0, zBow: 0.5, zTilt: 0, width: 2.6, rowsAcross: 14, scrollRepeats: 2 },
  { angleDeg: -13, length: 56, center: [-1.5, 2.0, -18.0], bow: 3.4, zBow: 1.0, zTilt: 3, width: 1.5, rowsAcross: 13, scrollRepeats: 3 },
];

/* --- 1B: three diagonals, mostly black ---------------------------- */
const BANDS_1B: BandRow[] = [
  { angleDeg: 31, length: 50, center: [-5.6, 5.2, -3.5], bow: 1.4, zBow: 1.6, zTilt: 3, width: 1.95, rowsAcross: 6, scrollRepeats: 1 },
  { angleDeg: 27, length: 44, center: [0.5, -0.3, 4.4], bow: 1.0, zBow: 1.2, zTilt: -2, width: 1.72, rowsAcross: 6, scrollRepeats: 3 },
  { angleDeg: 24, length: 52, center: [6.4, -6.2, -4.5], bow: 1.6, zBow: 1.8, zTilt: 3, width: 2.25, rowsAcross: 6, scrollRepeats: 2 },
  { angleDeg: 29, length: 56, center: [-7.5, -2.0, -17.0], bow: 2.2, zBow: 0.8, zTilt: 2, width: 1.25, rowsAcross: 6, scrollRepeats: 2 },
];

/* --- 1C: two families of arcs crossing in an X -------------------- */
const BANDS_1C: BandRow[] = [
  // The sharp band is kept nearly flat in depth so the focal plane can hold a
  // long readable stretch rather than a sliver at one edge.
  { angleDeg: 12, length: 46, center: [0.0, -2.6, 4.6], bow: 2.8, zBow: 0.6, zTilt: -0.8, width: 1.5, rowsAcross: 9, scrollRepeats: 3 },
  { angleDeg: 21, length: 50, center: [-1.6, 0.6, -5.5], bow: 3.2, zBow: 2.0, zTilt: 3.5, width: 1.95, rowsAcross: 9, scrollRepeats: 1 },
  { angleDeg: -34, length: 48, center: [2.0, 3.4, -2.2], bow: -2.9, zBow: 3.0, zTilt: 2.5, width: 1.66, rowsAcross: 9, scrollRepeats: 2 },
  { angleDeg: -26, length: 54, center: [3.2, -0.8, -9.5], bow: -3.4, zBow: 1.6, zTilt: -3.5, width: 2.3, rowsAcross: 10, scrollRepeats: 2 },
  { angleDeg: -18, length: 58, center: [-2.2, 4.6, -18.0], bow: -3.0, zBow: 1.2, zTilt: 3, width: 1.4, rowsAcross: 9, scrollRepeats: 3 },
];

const RACK_BASE: RackOptions = {
  count: 26,
  spacing: 1.16,
  radius: 0.46,
  halfLength: 22,
  zStart: 5.0,
  y: 0,
  sag: 0.12,
  litCount: 16,
  collarCount: 5,
  withCollars: true,
};

const DIAGONAL_BASE: RackOptions = {
  ...RACK_BASE,
  count: 12,
  spacing: 1.02,
  radius: 0.44,
  zStart: 3.2,
  litCount: 12,
  withCollars: false,
};

export const LOOKS: LookConfig[] = [
  {
    id: "DataRibbon-Bokeh",
    outName: "DataRibbon_Bokeh",
    palette: BLUE,
    strands: buildRibbons(BANDS_1A),
    camera: RIBBON_CAMERA,
    dof: { worldFocusDistance: 13.1, worldFocusRange: 2.8, bokehScale: 8.5 },
    bloom: { threshold: 3.0, smoothing: 0.35, intensity: 0.85, radius: 0.7 },
    shading: RIBBON_SHADING,
    bokeh: { count: 150, spread: [36, 24], z: [-26, -1.5], radius: [0.3, 1.5] },
    ground: null,
    pureBlack: false,
    stillFrames: [60, 250, 470],
  },
  {
    id: "DataRibbon-Minimal",
    outName: "DataRibbon_Minimal",
    palette: BLUE,
    strands: buildRibbons(BANDS_1B),
    camera: RIBBON_CAMERA,
    dof: { worldFocusDistance: 13.6, worldFocusRange: 3.6, bokehScale: 11 },
    bloom: { threshold: 3.0, smoothing: 0.35, intensity: 0.85, radius: 0.7 },
    shading: RIBBON_SHADING,
    bokeh: null,
    ground: null,
    pureBlack: true,
    stillFrames: [40, 270, 500],
  },
  {
    id: "DataRibbon-Crossing",
    outName: "DataRibbon_Crossing",
    palette: BLUE,
    strands: buildRibbons(BANDS_1C),
    camera: RIBBON_CAMERA,
    dof: { worldFocusDistance: 13.2, worldFocusRange: 2.8, bokehScale: 11 },
    bloom: { threshold: 3.0, smoothing: 0.35, intensity: 0.85, radius: 0.7 },
    shading: RIBBON_SHADING,
    bokeh: null,
    ground: null,
    pureBlack: true,
    stillFrames: [80, 300, 520],
  },
  {
    id: "DataRibbon-CrossingGreen",
    outName: "DataRibbon_CrossingGreen",
    palette: GREEN,
    strands: buildRibbons(BANDS_1C),
    camera: RIBBON_CAMERA,
    dof: { worldFocusDistance: 13.2, worldFocusRange: 2.8, bokehScale: 11 },
    // Green carries ~1.3x blue's luminance for the same intensity, so at the
    // shared threshold far more of it blooms, and the wider halo lifted this
    // composition off the true black it is sold as. The threshold is scaled to
    // match, which is what keeps the colourway a one-row change in practice.
    bloom: { threshold: 4.1, smoothing: 0.35, intensity: 0.8, radius: 0.62 },
    shading: RIBBON_SHADING,
    bokeh: null,
    ground: null,
    pureBlack: true,
    stillFrames: [80, 300, 520],
  },
  {
    id: "CableBundle-Diagonal",
    outName: "CableBundle_Diagonal",
    palette: BLUE,
    strands: buildRack(DIAGONAL_BASE),
    camera: { position: [-7.5, 3.55, 9.0], lookAt: [4.6, -0.85, -1.2], fov: 30 },
    dof: { worldFocusDistance: 11.8, worldFocusRange: 3.0, bokehScale: 5.5 },
    bloom: { threshold: 3.0, smoothing: 0.35, intensity: 0.85, radius: 0.7 },
    shading: CABLE_SHADING,
    bokeh: null,
    ground: { y: -0.78, intensity: 0.22, fade: 1.5 },
    pureBlack: false,
    stillFrames: [70, 290, 510],
  },
  {
    id: "CableBundle-Rack",
    outName: "CableBundle_Rack",
    palette: BLUE,
    strands: buildRack(RACK_BASE),
    camera: { position: [-8.2, 1.75, 6.9], lookAt: [5.5, -0.45, -5.0], fov: 34 },
    dof: { worldFocusDistance: 8.5, worldFocusRange: 6.0, bokehScale: 4.5 },
    // Tighter than the rest of the set. The rack's far cables throw enough
    // halo at some scroll positions to lift every quadrant off true black,
    // and this composition is sold as a screen-blend overlay.
    bloom: { threshold: 3.8, smoothing: 0.3, intensity: 0.8, radius: 0.55 },
    shading: CABLE_SHADING,
    bokeh: null,
    ground: null,
    pureBlack: true,
    stillFrames: [55, 275, 495],
  },
  {
    id: "CableBundle-Macro",
    outName: "CableBundle_Macro",
    palette: BLUE,
    strands: buildRack(RACK_BASE),
    camera: { position: [-2.0, 0.6, 7.6], lookAt: [5.2, -0.1, 3.6], fov: 26 },
    dof: { worldFocusDistance: 4.3, worldFocusRange: 1.5, bokehScale: 11 },
    bloom: { threshold: 3.0, smoothing: 0.35, intensity: 0.85, radius: 0.7 },
    shading: CABLE_SHADING,
    bokeh: null,
    ground: { y: -0.72, intensity: 0.26, fade: 1.3 },
    pureBlack: false,
    stillFrames: [90, 310, 530],
  },
  {
    id: "CableBundle-RackAmber",
    outName: "CableBundle_RackAmber",
    palette: AMBER,
    strands: buildRack(RACK_BASE),
    camera: { position: [-8.2, 1.75, 6.9], lookAt: [5.5, -0.45, -5.0], fov: 34 },
    dof: { worldFocusDistance: 8.5, worldFocusRange: 6.0, bokehScale: 4.5 },
    // Tighter than the rest of the set. The rack's far cables throw enough
    // halo at some scroll positions to lift every quadrant off true black,
    // and this composition is sold as a screen-blend overlay.
    bloom: { threshold: 3.8, smoothing: 0.3, intensity: 0.8, radius: 0.55 },
    shading: CABLE_SHADING,
    bokeh: null,
    ground: null,
    pureBlack: true,
    stillFrames: [55, 275, 495],
  },
];
