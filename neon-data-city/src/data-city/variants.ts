import { CELL } from "./constants";

/**
 * One depth band = one rendered layer = one blur amount.
 *
 * Depth-of-field is faked by slicing the scene into bands by camera distance,
 * rendering each band to its own canvas and blurring the canvases. Bars near a
 * band boundary are cross-faded in the shader (`fade`), so the blur ramps
 * smoothly instead of stepping at the seam.
 *
 * `blur` is expressed in composition pixels (i.e. at 3840x2160). Remotion's
 * `--scale` shrinks the whole page, so the same value produces a matching look
 * at 1080p and at 4K.
 */
export type Band = {
  /** Camera-space distance where this band starts. */
  near: number;
  /** Camera-space distance where this band ends. */
  far: number;
  /** CSS blur radius, in composition pixels. */
  blur: number;
  /** Half-width of the cross-fade at each boundary, in world units. */
  fade: number;
};

export type Palette = {
  /** First bar hue — the noise field pools colours toward this or `b`. */
  a: string;
  b: string;
  /** Rare "hot" bars burn out toward this. */
  hot: string;
  /** Dim per-cell lattice. */
  gridFine: string;
  /** Bold lattice drawn every `boldEvery` cells. */
  gridBold: string;
  /** Faint haze lying on the plane. */
  bed: string;
};

export type VariantConfig = {
  id: string;
  palette: Palette;
  camera: {
    fov: number;
    position: [number, number, number];
    target: [number, number, number];
    /** Peak lateral drift in world units; returns to zero at the loop point. */
    driftX: number;
    driftZ: number;
  };
  plane: {
    minX: number;
    maxX: number;
    /** Far edge. This is the boundary that reads as the diagonal in frame. */
    minZ: number;
    maxZ: number;
    boldEvery: number;
    /** Lattice fades out over [fadeStart, fadeEnd] in camera distance. */
    fadeStart: number;
    fadeEnd: number;
    fineOpacity: number;
    boldOpacity: number;
    bedOpacity: number;
    fineWidthPx: number;
    boldWidthPx: number;
  };
  bars: {
    /** Fraction of visible lattice cells that carry a bar. */
    occupancy: number;
    /** Bars dim to nothing over [fadeStart, fadeEnd] in camera distance. */
    fadeStart: number;
    fadeEnd: number;
    /** Bars past this distance are never built. Must sit at or past fadeEnd. */
    maxDist: number;
    /** Cross-section as a fraction of one cell. */
    width: number;
    /** Tallest possible bar, in cells. */
    maxHeight: number;
    /** Height distribution exponent — higher means tall bars are rarer. */
    heightPow: number;
    minHeight: number;
    /** Fraction of bars that make large jumps rather than gentle moves. */
    jumpFraction: number;
    /** Fraction of bars that burn out toward white. */
    hotFraction: number;
    /** Radius of the glowing tip dot, in cells. */
    dotSize: number;
    /** Minimum on-screen dot diameter, in composition pixels. */
    dotMinPx: number;
    /** Fraction of bars that get a tip dot. */
    dotFraction: number;
    exposure: number;
  };
  bands: Band[];
  bloom: {
    blur: number;
    opacity: number;
    sizeScale: number;
  };
  /** Film grain strength, 0-1. */
  grain: number;
};

/**
 * Builds a camera from angles rather than a look-at point, because the framing
 * is defined by angles: the plane's edge only reads as the diagonal it does in
 * the reference at one particular combination of yaw (how far the view is
 * turned off the lattice direction) and pitch (which sets where the horizon
 * sits, and therefore how steeply the edge climbs across frame).
 */
const rig = (cx: number, cy: number, cz: number, yaw: number, pitch: number) => {
  const d = Math.PI / 180;
  const dir: [number, number, number] = [
    -Math.sin(yaw * d) * Math.cos(pitch * d),
    -Math.sin(pitch * d),
    -Math.cos(yaw * d) * Math.cos(pitch * d),
  ];
  return {
    position: [cx, cy, cz] as [number, number, number],
    target: [cx + dir[0] * 60, cy + dir[1] * 60, cz + dir[2] * 60] as [
      number,
      number,
      number,
    ],
  };
};

const NEON: Palette = {
  a: "#d926d9",
  b: "#3b5bf0",
  hot: "#fff2ff",
  gridFine: "#2b2f9e",
  gridBold: "#4a3ad0",
  bed: "#0d1046",
};

const CYAN: Palette = {
  a: "#22d3ee",
  b: "#1e6fd9",
  hot: "#f2ffff",
  gridFine: "#1a5a86",
  gridBold: "#2a86c8",
  bed: "#04222e",
};

/**
 * V1 — the reference match.
 *
 * The camera hovers just off the plane's right-hand edge and looks back across
 * it, turned 36 degrees off the lattice and pitched 43.5 degrees down. Those
 * two angles are what put the edge on screen as a diagonal running from 19% in
 * at the bottom of frame to 79% in at the top, leaving the upper-right in
 * black. That wedge is title space: nothing is ever placed in it.
 */
export const V1: VariantConfig = {
  id: "V1-DataCityMagenta",
  palette: NEON,
  camera: {
    fov: 34,
    ...rig(38, 60, 60, 36, 43.5),
    driftX: 1.3,
    driftZ: 0.9,
  },
  plane: {
    // The right-hand edge sits at x = 0 and is the only boundary in frame; the
    // other three are pushed far enough out that the distance fade reaches zero
    // before they could ever be seen.
    minX: -300,
    maxX: 0,
    minZ: -220,
    maxZ: 130,
    boldEvery: 4,
    fadeStart: 105,
    fadeEnd: 200,
    fineOpacity: 0.42,
    boldOpacity: 0.8,
    bedOpacity: 0.09,
    fineWidthPx: 1.6,
    boldWidthPx: 3.2,
  },
  bars: {
    occupancy: 0.4,
    fadeStart: 120,
    fadeEnd: 182,
    maxDist: 186,
    width: 0.12 * CELL,
    maxHeight: 8,
    heightPow: 2.9,
    minHeight: 0.12,
    jumpFraction: 0.13,
    hotFraction: 0.035,
    dotSize: 0.105,
    dotMinPx: 2.6,
    dotFraction: 0.62,
    exposure: 1.55,
  },
  // Visible bars span roughly 73 to 151 units from the camera. Focus sits in
  // the mid-field; the foreground goes soft and the far field softens again.
  // The overlapping fades turn four fixed blur values into a continuous ramp:
  // ~14px at the bottom edge of frame, through ~10 and ~3, to sharp by about
  // 45% up, then softening again into the far field.
  bands: [
    { near: 0, far: 82, blur: 14, fade: 6.0 },
    { near: 82, far: 92, blur: 6, fade: 5.0 },
    { near: 92, far: 116, blur: 0, fade: 6.0 },
    { near: 116, far: 1e6, blur: 3, fade: 9.0 },
  ],
  bloom: { blur: 22, opacity: 0.68, sizeScale: 1.9 },
  grain: 0.015,
};

/** V2 — same camera and structure as V1, cooler "data centre" palette. */
export const V2: VariantConfig = {
  ...V1,
  id: "V2-DataCityCyan",
  palette: CYAN,
  bars: { ...V1.bars, exposure: 1.6 },
  bloom: { blur: 22, opacity: 0.62, sizeScale: 1.9 },
};

/**
 * V3 — wide shot. A different framing, not a repaint.
 *
 * The camera is pulled back and raised until the whole depth of the grid reads
 * at once, so the boundary in frame is the plane's far edge rather than its
 * side: it lands about 40% down from the top and the void fills the band above
 * it. Bars keep their height in cells, so the silhouette against the lattice is
 * unchanged while everything reads smaller and denser on screen.
 */
export const V3: VariantConfig = {
  id: "V3-DataCityWide",
  palette: NEON,
  camera: {
    fov: 30,
    ...rig(30, 110, 121, -8, 36),
    driftX: 2.2,
    driftZ: 1.4,
  },
  plane: {
    // Wide enough that the side edges stay outside the frame at the far edge —
    // the only boundary meant to be visible here is minZ.
    minX: -420,
    maxX: 260,
    // The far edge, and the only one in frame.
    minZ: -47,
    maxZ: 240,
    boldEvery: 4,
    fadeStart: 150,
    fadeEnd: 320,
    fineOpacity: 0.36,
    boldOpacity: 0.7,
    bedOpacity: 0.08,
    fineWidthPx: 1.4,
    boldWidthPx: 2.8,
  },
  bars: {
    occupancy: 0.38,
    // The far edge is meant to be seen here, so bars stay bright almost all the
    // way to it and the cut stays crisp. maxDist sits past the farthest point
    // of the plane that can reach the frame, so the cull never bites before
    // the edge does — otherwise it shows up as an arc across the far field.
    fadeStart: 190,
    fadeEnd: 340,
    maxDist: 300,
    width: 0.1 * CELL,
    maxHeight: 8,
    heightPow: 2.9,
    minHeight: 0.1,
    jumpFraction: 0.13,
    hotFraction: 0.035,
    dotSize: 0.085,
    dotMinPx: 2.2,
    dotFraction: 0.62,
    exposure: 1.5,
  },
  // Visible bars span roughly 141 to 223 units. Much shallower than V1 —
  // near-field softening only, with the bulk of the grid in focus.
  bands: [
    { near: 0, far: 155, blur: 6, fade: 7.0 },
    { near: 155, far: 172, blur: 2, fade: 6.0 },
    { near: 172, far: 1e6, blur: 0, fade: 8.0 },
  ],
  bloom: { blur: 18, opacity: 0.55, sizeScale: 1.7 },
  grain: 0.015,
};

export const VARIANTS: Record<string, VariantConfig> = {
  [V1.id]: V1,
  [V2.id]: V2,
  [V3.id]: V3,
};
