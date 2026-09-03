/**
 * THE single source of colour and per-variant configuration.
 *
 * Every hex literal in this project lives in this file. The three variants
 * share one perspective engine; all that changes between them is the palette,
 * which element renderer fills the corridor, how many elements there are,
 * where the horizon sits and how wide the open band is.
 */

export const LOOP_FRAMES = 375;
export const FPS = 30;
export const VIDEO_WIDTH = 3840;
export const VIDEO_HEIGHT = 2160;

export type VariantId = "fibre" | "slab" | "block";

export interface OpenBandConfig {
  /** Band height as a fraction of frame height. */
  height: number;
  /** Band centre offset from the horizon, as a fraction of frame height. */
  offset: number;
  /** Alpha that survives inside the band. 0 = nothing at all shows through. */
  residual: number;
}

export interface CorridorVariant {
  id: VariantId;
  /** Which renderer fills the corridor. The engine never reads this. */
  elementType: VariantId;
  palette: Record<string, string>;
  /** Number of corridor elements. */
  density: number;
  /** Horizon height as a fraction of frame height. */
  horizon: number;
  /** Half-width of the corridor at d = 1, as a multiple of frame width. */
  spread: number;
  /** Depth-1 plane edges, as fractions of frame height (outside the frame). */
  floorEdge: number;
  ceilEdge: number;
  openBand: OpenBandConfig;
  /** Composite mode used inside the depth-of-field buffers. */
  blend: GlobalCompositeOperation;
  /** Blur radius in 4K pixels for the far and near depth buckets. */
  dof: { far: number; near: number };
  horizonGlow: {
    /** Core radius as a fraction of frame height. */
    radius: number;
    intensity: number;
    /** Horizontal stretch of the glow along the horizon line. */
    stretch: number;
  };
  bokeh: { count: number; frontShare: number; minR: number; maxR: number; alpha: number };
  bloom: { radius: number; strength: number };
  vignette: number;
  grainAlpha: number;
  /** Ambient camera drift amplitude in 4K pixels. */
  drift: number;
}

const SHADOW = "#000000";

export const VARIANTS: Record<VariantId, CorridorVariant> = {
  fibre: {
    id: "fibre",
    elementType: "fibre",
    palette: {
      backgroundDeep: "#030A1A",
      backgroundWash: "#0A2450",
      strandBlue: "#2E7FD4",
      strandPale: "#7FC4F5",
      strandWhite: "#E8F8FF",
      packetCyan: "#4FE8FF",
      packetWhite: "#FFFFFF",
      horizonGlow: "#5FA8F5",
      bokehBlue: "#4F9FE8",
      shadow: SHADOW,
    },
    density: 90,
    horizon: 0.4,
    spread: 1.65,
    floorEdge: 1.24,
    ceilEdge: -0.24,
    openBand: { height: 0.1, offset: 0, residual: 0.16 },
    blend: "lighter",
    dof: { far: 9, near: 26 },
    horizonGlow: { radius: 0.26, intensity: 0.86, stretch: 2.6 },
    bokeh: { count: 30, frontShare: 0.34, minR: 70, maxR: 330, alpha: 0.1 },
    bloom: { radius: 90, strength: 0.5 },
    vignette: 0.22,
    grainAlpha: 0.04,
    drift: 8,
  },

  slab: {
    id: "slab",
    elementType: "slab",
    palette: {
      backgroundDeep: "#01060F",
      backgroundWash: "#061A38",
      slabFill: "#0A2848",
      slabEdge: "#2E6FA8",
      slabBright: "#6FB8E8",
      textPale: "#4F8FC4",
      textBright: "#A8D8F5",
      horizonGlow: "#3F8FD4",
      bokehBlue: "#2E6FA8",
      shadow: SHADOW,
    },
    density: 220,
    horizon: 0.5,
    spread: 1.7,
    floorEdge: 1.3,
    ceilEdge: -0.3,
    openBand: { height: 0.26, offset: 0, residual: 0.07 },
    blend: "lighter",
    dof: { far: 9, near: 26 },
    horizonGlow: { radius: 0.27, intensity: 1.05, stretch: 2.8 },
    bokeh: { count: 30, frontShare: 0.34, minR: 80, maxR: 360, alpha: 0.085 },
    bloom: { radius: 96, strength: 0.44 },
    vignette: 0.22,
    grainAlpha: 0.04,
    drift: 8,
  },

  block: {
    id: "block",
    elementType: "block",
    palette: {
      backgroundDeep: "#010614",
      backgroundWash: "#08204A",
      blockFill: "#1A4A8A",
      blockBright: "#7FD4FF",
      blockWarm: "#F5A03F",
      digitPale: "#4F9FD4",
      digitBright: "#C8E8FF",
      horizonGlow: "#5FC4FF",
      bokehBlue: "#3F8FD4",
      shadow: SHADOW,
    },
    density: 180,
    horizon: 0.58,
    spread: 1.0,
    floorEdge: 1.26,
    ceilEdge: -0.1,
    openBand: { height: 0.12, offset: -0.075, residual: 0.05 },
    blend: "lighter",
    dof: { far: 9, near: 26 },
    horizonGlow: { radius: 0.26, intensity: 0.95, stretch: 2.4 },
    bokeh: { count: 30, frontShare: 0.34, minR: 70, maxR: 320, alpha: 0.09 },
    bloom: { radius: 88, strength: 0.52 },
    vignette: 0.22,
    grainAlpha: 0.04,
    drift: 8,
  },
};

/** Extra element counts that are not part of the headline density. */
export const EXTRA_COUNTS = {
  /** v2: thin bright lines running along the corridor's depth axis. */
  slabDepthLines: 14,
  /** v3: vertical columns of binary digits standing between the clusters. */
  binaryColumns: 50,
} as const;
