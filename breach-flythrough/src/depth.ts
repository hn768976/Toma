/**
 * Depth model for the flythrough.
 *
 * Every element is a flat billboard parked at a fixed Z inside a CSS
 * `perspective` container. Rather than moving a camera, each layer's Z is
 * computed directly from the frame and wrapped over one full cycle, so a layer
 * that passes the camera reappears at the back with no state carried between
 * frames. Travel over `durationInFrames` is exactly one cycle, which puts every
 * layer back where it started — that is what makes the loop seamless.
 *
 * All distances are expressed in composition pixels derived from the frame
 * width, so the geometry and the blur radii scale together at any render scale.
 */

export const LAYER_COUNT = 8;

export type DepthConfig = {
  /** CSS `perspective` in px. */
  perspective: number;
  /** Gap between adjacent layers. */
  spacing: number;
  /** Distance a layer travels before it wraps — one full loop's worth. */
  cycle: number;
  /** Closest a layer gets before it wraps to the back. */
  zNear: number;
  /** Where a layer re-enters. */
  zFar: number;
  /** Z of the sharp slab. */
  zFocus: number;
  /** Half-thickness of the slab that renders perfectly sharp. */
  focusSlab: number;
  /** Blur growth per px of Z, in front of and behind the focal plane. */
  blurNear: number;
  blurFar: number;
  /** Ceiling on the on-screen blur radius, in px. */
  maxScreenBlur: number;
};

export const depthConfig = (width: number): DepthConfig => {
  // Everything below is authored against a 3840px-wide frame.
  const u = width / 3840;
  const spacing = 900 * u;
  const cycle = LAYER_COUNT * spacing;
  const zNear = 1450 * u;
  return {
    perspective: 3000 * u,
    spacing,
    cycle,
    zNear,
    zFar: zNear - cycle,
    zFocus: -250 * u,
    focusSlab: 200 * u,
    blurNear: 0.048,
    blurFar: 0.0105,
    maxScreenBlur: 150 * u,
  };
};

const mod = (value: number, m: number) => ((value % m) + m) % m;

/** Z of layer `index` at `frame`, wrapping over exactly one cycle per loop. */
export const layerZ = (
  cfg: DepthConfig,
  index: number,
  frame: number,
  durationInFrames: number,
): number => {
  const travel = cfg.cycle * (frame / durationInFrames);
  return cfg.zFar + mod(index * cfg.spacing + travel, cfg.cycle);
};

/** Perspective scale factor the browser will apply to a plane at `z`. */
export const scaleAtZ = (cfg: DepthConfig, z: number): number =>
  cfg.perspective / (cfg.perspective - z);

const smoothstep = (edge0: number, edge1: number, x: number) => {
  const t = Math.min(1, Math.max(0, (x - edge0) / (edge1 - edge0)));
  return t * t * (3 - 2 * t);
};

/**
 * Opacity envelope over a layer's travel. It is zero at both ends of the
 * cycle, so the instant a layer wraps from the near limit back to the far
 * plane it is invisible and the jump cannot be seen. The long ramp-in also
 * doubles as aerial perspective: deep layers read as dim haze.
 */
export const depthOpacity = (cfg: DepthConfig, z: number): number => {
  const t = (z - cfg.zFar) / cfg.cycle;
  return smoothstep(0, 0.3, t) * (1 - smoothstep(0.82, 1, t));
};

/**
 * Blur radius to apply to the layer *before* the perspective transform.
 *
 * CSS filters run in the element's own coordinate space and the 3D transform
 * then scales the result, so the on-screen radius is `local * scale`. Working
 * back from a thin-lens circle of confusion (which is proportional to
 * `|1/dist - 1/focusDist|`) the local radius comes out linear in the distance
 * from the focal plane — with a gentler coefficient behind the plane than in
 * front of it, so the deep grids stay legible as texture while the layers
 * about to pass the camera smear out completely.
 */
export const layerBlur = (cfg: DepthConfig, z: number): number => {
  const offset = Math.max(0, Math.abs(z - cfg.zFocus) - cfg.focusSlab);
  const local = offset * (z > cfg.zFocus ? cfg.blurNear : cfg.blurFar);
  const scale = scaleAtZ(cfg, z);
  return Math.min(local, cfg.maxScreenBlur / scale);
};

/**
 * Camera drift: a slow lateral/vertical float plus a degree of roll. Two
 * harmonics at integer multiples of the loop frequency keep it from feeling
 * like a single sine while staying exactly periodic.
 */
export const cameraDrift = (
  frame: number,
  durationInFrames: number,
  width: number,
) => {
  const u = width / 3840;
  const p = (2 * Math.PI * frame) / durationInFrames;
  return {
    x: (Math.sin(p) * 90 + Math.sin(2 * p + 0.9) * 30) * u,
    y: (Math.cos(p + 1.1) * 58 + Math.sin(2 * p + 2.4) * 22) * u,
    roll: Math.sin(p + 0.6) * 0.75 + Math.sin(2 * p + 1.8) * 0.25,
  };
};
