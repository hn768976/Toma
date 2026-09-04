// Everything the three versions share. Geometry and timing are identical
// across V1/V2/V3 by construction: only `palette` differs.

export type PaletteId = 'mono' | 'gold' | 'blue';

export const PALETTE_INDEX: Record<PaletteId, number> = {
  mono: 0,
  gold: 1,
  blue: 2,
};

export const LOOK = {
  /** Horizon centre: 32% from the left, 45% from the top. */
  center: [0.32, 0.45] as [number, number],
  /** Rays per pixel per axis. 2 = 4x supersampling. */
  supersample: 2,
  exposure: 1.05,
  /** ~2% grain, the cheapest defence against H.264 banding in the falloffs. */
  grain: 0.022,
  bloomTight: 1.1,
  bloomWide: 2.6,
  /** Above the outer disc's radiance, so only the ring and inner edge bloom. */
  bloomThreshold: 0.90,
};

export const FPS = 30;
export const DURATION_IN_FRAMES = 900; // 30s
export const WIDTH = 3840;
export const HEIGHT = 2160;
