// The bokeh field: the body of the piece. Discs are generated once from
// seeds, and each is baked to its own offscreen sprite (gradient + blur +
// glow) so a frame is 90 drawImage calls rather than 90 gradient builds
// and 90 blur passes at 4K.

import {
  BOKEH_ADDITIVE_FRACTION,
  BOKEH_ALPHA_RANGE,
  BOKEH_BLUR_RANGE,
  BOKEH_BREATHE_AMOUNT,
  BOKEH_CLUSTERED_FRACTION,
  BOKEH_CLUSTER_COUNT,
  BOKEH_COLOR_WEIGHTS,
  BOKEH_COUNT,
  BOKEH_DRIFT_RANGE,
  BOKEH_SIZE_RANGE,
  DURATION_IN_FRAMES,
} from "./config";
import { createCanvas, TAU } from "./canvas";
import {
  rand,
  randGaussian,
  randInt,
  randPick,
  randRange,
  randWeighted,
} from "./rand";
import { lighten, rgba, type BokehColorName, type Theme } from "./theme";

export type BokehDisc = {
  id: number;
  /** Diameter in composition px. */
  size: number;
  /** 0 = smallest/sharpest, 1 = largest/softest. */
  depth: number;
  blur: number;
  alpha: number;
  color: BokehColorName;
  x: number;
  y: number;
  /** Closed Lissajous drift path. */
  driftX: number;
  driftY: number;
  driftCyclesX: number;
  driftCyclesY: number;
  driftPhaseX: number;
  driftPhaseY: number;
  /** Brightness breathing; cycles is a whole number over 240 frames. */
  breatheCycles: number;
  breathePhase: number;
  additive: boolean;
};

// Drift and breathe rates are whole cycles per 240-frame loop, which is
// what makes frame 240 land exactly on frame 0.
const DRIFT_CYCLE_CHOICES = [1, 1, 2, 2, 3] as const;
const BREATHE_CYCLE_CHOICES = [1, 2, 3, 4] as const;

/**
 * Cluster centres, weighted toward the frame edges. Placing most discs
 * around these gives the field uneven density — pools and clear regions —
 * and keeps the middle of the frame open enough to hold copy.
 */
const clusterCentres = (width: number, height: number) => {
  const centres: { x: number; y: number; radius: number }[] = [];
  for (let i = 0; i < BOKEH_CLUSTER_COUNT; i++) {
    const angle = randRange(`cluster-angle-${i}`, 0, TAU);
    // Never inside 0.42 of the half-diagonal, so clusters hug the edges.
    const spread = randRange(`cluster-spread-${i}`, 0.42, 0.92);
    centres.push({
      x: width * (0.5 + Math.cos(angle) * 0.58 * spread),
      y: height * (0.5 + Math.sin(angle) * 0.58 * spread),
      radius: randRange(`cluster-radius-${i}`, 0.13, 0.27) * width,
    });
  }
  return centres;
};

/**
 * Edge-weighted scatter position. Rejection-samples a handful of seeded
 * candidates and keeps the one furthest from centre, which thins the
 * middle without leaving it empty.
 */
const scatterPosition = (id: number, width: number, height: number) => {
  let best = { x: width / 2, y: height / 2, score: -1 };
  for (let attempt = 0; attempt < 4; attempt++) {
    const x = randRange(`scatter-x-${id}-${attempt}`, -0.08, 1.08) * width;
    const y = randRange(`scatter-y-${id}-${attempt}`, -0.08, 1.08) * height;
    const dx = (x - width / 2) / (width / 2);
    const dy = (y - height / 2) / (height / 2);
    const score =
      Math.hypot(dx, dy) + randRange(`scatter-j-${id}-${attempt}`, 0, 0.35);
    if (score > best.score) best = { x, y, score };
  }
  return best;
};

/**
 * `scale` converts the 4K-quoted lengths in config.ts into composition px,
 * so everything downstream — sprites included — is already in the units it
 * will be drawn in and no draw-time scaling is needed.
 */
export const generateBokeh = (
  width: number,
  height: number,
  scale: number,
): BokehDisc[] => {
  const clusters = clusterCentres(width, height);
  const discs: BokehDisc[] = [];

  for (let id = 0; id < BOKEH_COUNT; id++) {
    // depth 0 -> small, sharp, bright. depth 1 -> large, soft, transparent.
    const depth = Math.pow(rand(`bokeh-depth-${id}`), 1.25);
    const size =
      (BOKEH_SIZE_RANGE[0] +
        depth * (BOKEH_SIZE_RANGE[1] - BOKEH_SIZE_RANGE[0])) *
      scale;

    let x: number;
    let y: number;
    if (rand(`bokeh-clustered-${id}`) < BOKEH_CLUSTERED_FRACTION) {
      const cluster =
        clusters[randInt(`bokeh-cluster-${id}`, 0, clusters.length - 1)];
      x = cluster.x + randGaussian(`bokeh-cx-${id}`) * cluster.radius;
      y = cluster.y + randGaussian(`bokeh-cy-${id}`) * cluster.radius;
    } else {
      const scattered = scatterPosition(id, width, height);
      x = scattered.x;
      y = scattered.y;
    }

    discs.push({
      id,
      size,
      depth,
      blur:
        (BOKEH_BLUR_RANGE[0] +
          depth * (BOKEH_BLUR_RANGE[1] - BOKEH_BLUR_RANGE[0])) *
        randRange(`bokeh-blurvar-${id}`, 0.85, 1.15) *
        scale,
      // Bigger discs are dimmer: the light they scatter is spread wider.
      alpha:
        BOKEH_ALPHA_RANGE[1] -
        depth * (BOKEH_ALPHA_RANGE[1] - BOKEH_ALPHA_RANGE[0]),
      color: randWeighted(`bokeh-color-${id}`, BOKEH_COLOR_WEIGHTS),
      x,
      y,
      driftX:
        randRange(
          `bokeh-driftx-${id}`,
          BOKEH_DRIFT_RANGE[0],
          BOKEH_DRIFT_RANGE[1],
        ) * scale,
      driftY:
        randRange(
          `bokeh-drifty-${id}`,
          BOKEH_DRIFT_RANGE[0],
          BOKEH_DRIFT_RANGE[1],
        ) * scale,
      driftCyclesX: randPick(`bokeh-cyclex-${id}`, DRIFT_CYCLE_CHOICES),
      driftCyclesY: randPick(`bokeh-cycley-${id}`, DRIFT_CYCLE_CHOICES),
      driftPhaseX: randRange(`bokeh-phasex-${id}`, 0, TAU),
      driftPhaseY: randRange(`bokeh-phasey-${id}`, 0, TAU),
      breatheCycles: randPick(`bokeh-breathe-${id}`, BREATHE_CYCLE_CHOICES),
      breathePhase: randRange(`bokeh-breathephase-${id}`, 0, TAU),
      additive: rand(`bokeh-additive-${id}`) < BOKEH_ADDITIVE_FRACTION,
    });
  }

  // Farthest and softest first, so the sharp little discs sit on top.
  return discs.sort((a, b) => b.size - a.size);
};

/** Position of a disc on its closed drift path at `frame`. */
export const discPosition = (disc: BokehDisc, frame: number) => ({
  x:
    disc.x +
    disc.driftX *
      Math.sin(
        (TAU * disc.driftCyclesX * frame) / DURATION_IN_FRAMES +
          disc.driftPhaseX,
      ),
  y:
    disc.y +
    disc.driftY *
      Math.cos(
        (TAU * disc.driftCyclesY * frame) / DURATION_IN_FRAMES +
          disc.driftPhaseY,
      ),
});

/** Brightness multiplier from the disc's breathing sine. */
export const discBreath = (disc: BokehDisc, frame: number) =>
  1 +
  BOKEH_BREATHE_AMOUNT *
    Math.sin(
      (TAU * disc.breatheCycles * frame) / DURATION_IN_FRAMES +
        disc.breathePhase,
    );

/**
 * A real out-of-focus point renders as a disc with a slightly brighter rim
 * than centre — the lens aperture's edge. That rim is the whole difference
 * between bokeh and a soft circle, so the gradient peaks at ~0.82 of the
 * radius and falls off sharply just outside it.
 */
const RIM_STOPS: [number, number][] = [
  [0.0, 0.56],
  [0.34, 0.6],
  [0.62, 0.75],
  [0.82, 1.0],
  [0.9, 0.95],
  [0.96, 0.44],
  [1.0, 0.0],
];

export type BokehSprite = {
  canvas: HTMLCanvasElement;
  /** Sprite is square; this is half its side, i.e. the blit offset. */
  half: number;
};

export const buildBokehSprite = (
  disc: BokehDisc,
  theme: Theme,
): BokehSprite | null => {
  const radius = disc.size / 2;
  // Bright little discs carry a wider baked glow; big soft ones need less
  // or the frame turns to soup.
  const haloFactor = 2.1 - disc.depth * 0.8;
  const half = Math.ceil(radius * haloFactor + disc.blur * 3 + 4);
  const canvas = createCanvas(half * 2, half * 2);
  const ctx = canvas?.getContext("2d");
  if (!canvas || !ctx) return null;

  const hex = theme.bokeh[disc.color];
  const a = disc.alpha;

  ctx.filter = `blur(${disc.blur.toFixed(2)}px)`;

  // Baked bloom halo — this is most of the "generous bloom" on the
  // brightest discs, and it costs nothing per frame. It starts just inside
  // the rim rather than at the centre, so it spills outward without
  // filling the disc back in and flattening the rim.
  const haloRadius = radius * haloFactor;
  const halo = ctx.createRadialGradient(
    half,
    half,
    radius * 0.88,
    half,
    half,
    haloRadius,
  );
  halo.addColorStop(0, rgba(hex, a * 0.26));
  halo.addColorStop(0.35, rgba(hex, a * 0.09));
  halo.addColorStop(1, rgba(hex, 0));
  ctx.fillStyle = halo;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // The disc itself, rim-weighted.
  const body = ctx.createRadialGradient(half, half, 0, half, half, radius);
  for (const [stop, weight] of RIM_STOPS) {
    // The rim, not the centre, is where the light piles up, so that is
    // where the colour desaturates toward white — an over-exposed edge
    // rather than a flat coloured dot with a hot middle.
    const whiten = stop * 0.2 * (1 - disc.depth * 0.45);
    body.addColorStop(stop, lighten(hex, whiten, a * weight));
  }
  ctx.fillStyle = body;
  ctx.beginPath();
  ctx.arc(half, half, radius, 0, TAU);
  ctx.fill();

  ctx.filter = "none";
  return { canvas, half };
};
