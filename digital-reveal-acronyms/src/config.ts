// Timing (frames @ 30fps) and layout constants. All sizes are fractions of
// the frame height, so the same values work at 1080p, 4K and 6000x3375.

export const FPS = 30;
export const DURATION = 600;
export const WIDTH = 3840;
export const HEIGHT = 2160;

export const T = {
  stormStart: 45,
  convergeStart: 150,
  convergeEnd: 210,
  outlineStart: 210,
  burstStart: 260,
  settleStart: 300,
  holdStart: 340,
} as const;

// Cap height of the word, as a fraction of frame height. Same for every word.
export const CAP_FRAC = 0.12;

// Particle count (one instanced mesh). Lower this first if renders are slow.
export const PARTICLE_COUNT = 6000;

// 3D camera: word plane is z = 0, camera on +z looking at the origin.
export const CAM_DIST = 50;
export const CAM_FOV = 40;
// Height of the visible frame at the word plane, in world units.
export const VIEW_H = 2 * CAM_DIST * Math.tan(((CAM_FOV / 2) * Math.PI) / 180);

export const COLORS = {
  bgCentre: "#0b4f7c",
  bgMid: "#043658",
  bgEdge: "#001a2c",
  line: "#8fd0ff",
  outline: "#e8f6ff",
  glow: "#43aefc",
  halo: "#9fd4ff",
  orange: "#ff6a10",
} as const;
