/**
 * Single source of truth for the scene. Every composition is just a different
 * `SceneConfig` handed to the same renderer.
 */

export const FPS = 30;
export const LOOP_FRAMES = 600; // 20s @ 30fps
export const MASTER_WIDTH = 3840;
export const MASTER_HEIGHT = 2160;

/** World-space width of one repeating tile. Camera trucks exactly this far. */
export const TILE_WIDTH = 90;
/** Number of tile copies laid out along X (centre copy + one either side). */
export const TILE_COPIES = 3;

/** Depth-of-field: blur sigma in pixels at 3840x2160, per bucket. */
export const DOF_BLUR_PX = [0, 3, 8, 18, 34] as const;
/** |z - focusZ| upper bound that puts an object in each bucket. */
export const DOF_BANDS = [6, 13, 22, 32, Infinity] as const;

export type SceneConfig = {
  id: string;
  /** ~82% of strands and all data rows draw from here. */
  cool: string[];
  /** ~18% accent family; concentrated in the pinch-node cores. */
  warm: string[];
  /** Sparse "hot pixel" colours sprinkled through the data rows. */
  hot: string[];
  background: {
    base: string;
    glow: string;
    /** Glow centre in NDC-ish units, x negative = left of centre. */
    glowOffset: [number, number];
    glowRadius: number;
    vignette: number;
  };
  strandCount: number;
  /** Additive trim for ~800 overlapping strands; keeps the cores off the clip. */
  strandGain: number;
  /** Additive trim for the data-row glyphs. */
  glyphGain: number;
  strandSegments: number;
  /** Control points per strand before Catmull-Rom sampling. */
  strandControlPoints: number;
  nodeCount: number;
  rowCount: number;
  /** Camera truck distance along -X over the loop. Must equal TILE_WIDTH. */
  cameraTravel: number;
  camera: {
    fov: number;
    z: number;
    y: number;
    focusZ: number;
    dolly: number;
    bobAmplitude: number;
    bobCycles: number;
    rollDegrees: number;
    rollCycles: number;
  };
  bloom: {threshold: number; strength: number; radius: number};
  chromaticAberration: number;
  grain: number;
  exposure: number;
  seed: number;
};

const BASE: Omit<SceneConfig, 'id' | 'cool' | 'warm' | 'hot'> = {
  background: {
    base: '#04070e',
    glow: '#0d2244',
    glowOffset: [-0.28, 0.04],
    glowRadius: 0.82,
    vignette: 1.05,
  },
  strandCount: 900,
  strandGain: 0.85,
  glyphGain: 0.5,
  strandSegments: 56,
  strandControlPoints: 11,
  nodeCount: 8,
  rowCount: 17,
  cameraTravel: TILE_WIDTH,
  camera: {
    fov: 38,
    z: 55,
    y: 0,
    focusZ: 2,
    dolly: 2.2,
    bobAmplitude: 0.34,
    bobCycles: 1,
    rollDegrees: 0.45,
    rollCycles: 2,
  },
  bloom: {threshold: 0.62, strength: 1.2, radius: 1.0},
  chromaticAberration: 0.6,
  grain: 0.02,
  exposure: 1.0,
  seed: 20260909,
};

export const V1_CYAN_COPPER: SceneConfig = {
  ...BASE,
  id: 'v1-cyan-copper',
  cool: ['#3fa8ff', '#6fd2ff', '#a8e6ff', '#2b6fc4'],
  warm: ['#ff8a5c', '#e0673c', '#ffb08a'],
  hot: ['#ffffff', '#3fe0c0', '#ff7a3c'],
};

export const V2_TEAL_MAGENTA: SceneConfig = {
  ...BASE,
  id: 'v2-teal-magenta',
  cool: ['#2fe0c8', '#7ff5e2', '#bffff2', '#1f9e8c'],
  warm: ['#ff4d9e', '#d63a80', '#ff8ec0'],
  hot: ['#ffffff', '#7ff5e2', '#ff4d9e'],
};

export const V3_VIOLET_GOLD: SceneConfig = {
  ...BASE,
  id: 'v3-violet-gold',
  cool: ['#7b6cff', '#b0a4ff', '#d9d2ff', '#4a3fb0'],
  warm: ['#ffc247', '#e0a02a', '#ffdb92'],
  hot: ['#ffffff', '#b0a4ff', '#ffc247'],
};

export const ALL_CONFIGS = [V1_CYAN_COPPER, V2_TEAL_MAGENTA, V3_VIOLET_GOLD];
