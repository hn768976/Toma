/**
 * The subject: a brain in lateral view, facing left.
 *
 * The silhouette is authored in "brain units" (a hand-tuned 942x860 box)
 * and scaled to pixels once. It is the union of three filled pieces — the
 * cerebrum, a cerebellum tucked under the posterior, and a short
 * descending stem — with two fissures then CARVED OUT of the result:
 *
 *  - the SYLVIAN FISSURE, the deep cleft that enters from the front-lower
 *    edge and sweeps up and back. It is the feature that makes a lateral
 *    brain read as a brain: it cuts the temporal lobe free as a distinct
 *    forward-pointing lobe beneath the frontal and parietal mass.
 *  - the transverse fissure, separating the cerebellum from the cerebrum.
 *
 * Carving rather than shading matters: the gap is absent from the mask,
 * so no particle can ever land in it and the split stays legible. It also
 * doubles the outline the density weighting has to work with, so the
 * particles crowd along both lips of the cleft.
 *
 * The gyri are NOT drawn. They are generated as guide curves and used
 * only to weight particle density, so the folds emerge from where the
 * particles crowd. Each curve starts at a seeded interior point, sets off
 * roughly tangential to the nearest surface (the direction real
 * convolutions run) with up to ~50 degrees of seeded deviation, and then
 * walks with a curvature that itself wobbles — so they curl and wander
 * instead of stacking into parallel bands.
 */
import type { Field, Mask } from "../lib/maskSampler";
import { coverageField, distanceField, renderMask } from "../lib/maskSampler";
import { makeRng, range, rangeInt, type Rng } from "../lib/rng";
import {
  CEREBELLUM_FOLIA_COUNT,
  GYRI_COUNT,
} from "./config";

type P = [number, number];

// ---------------------------------------------------------- brain units

/** Bounding box of every piece below, used to map units -> pixels. */
export const UNIT_MIN_X = 20;
export const UNIT_MIN_Y = 40;
export const UNIT_MAX_X = 962;
export const UNIT_MAX_Y = 900;
export const UNIT_W = UNIT_MAX_X - UNIT_MIN_X;
export const UNIT_H = UNIT_MAX_Y - UNIT_MIN_Y;

/**
 * The cerebrum, clockwise from the frontal pole. Frontal lobe at the
 * left, crown a little forward of centre, occipital pole at the right,
 * and the temporal lobe running back along the underside. The kink at
 * (148, 528) is the notch the Sylvian fissure opens out of.
 */
const CEREBRUM: P[] = [
  [20, 425],
  [46, 318],
  [114, 212],
  [220, 126],
  [338, 70],
  [458, 42],
  [580, 40],
  [700, 64],
  [806, 120],
  [884, 202],
  [938, 304],
  [962, 418],
  [950, 508],
  [906, 574],
  [840, 616],
  [736, 652],
  [614, 702],
  [490, 738],
  [364, 748],
  [252, 732],
  [186, 702],
  [140, 646],
  [124, 584],
  [152, 526],
  [68, 480],
];

/** Cerebellum: a leaf tucked under the occipital, tip pointing forward. */
const CEREBELLUM = { cx: 800, cy: 668, rx: 182, ry: 120, rot: -0.62 };

/** Brainstem, short and thick, descending between temporal and cerebellum. */
const STEM: P[] = [
  [628, 650],
  [624, 730],
  [610, 800],
  [594, 858],
];
const STEM_WIDTHS = [128, 112, 96, 84];

/**
 * Sylvian fissure. Opens outside the silhouette at the front so the carve
 * reaches the edge cleanly, then sweeps up and back, tapering to a point
 * where it terminates inside the parietal mass.
 */
const SYLVIAN_FISSURE: P[] = [
  [40, 540],
  [180, 534],
  [310, 520],
  [430, 490],
  [534, 446],
  [612, 400],
  [664, 364],
];
const SYLVIAN_WIDTHS = [32, 40, 38, 35, 30, 20, 7];

/** Transverse fissure: cerebrum above, cerebellum below. */
const TRANSVERSE_FISSURE: P[] = [
  [634, 706],
  [720, 668],
  [806, 634],
  [880, 598],
  [962, 548],
];
const TRANSVERSE_WIDTHS = [8, 22, 22, 20, 10];

// ------------------------------------------------------------- path utils

/**
 * Emits a closed cardinal spline through `pts`. Tension 1/6 reproduces a
 * uniform Catmull-Rom; lower values pull the curve tighter to the hull,
 * which keeps a hand-placed outline from bulging between anchors.
 */
const closedSpline = (
  ctx: CanvasRenderingContext2D,
  pts: P[],
  tension = 0.16,
): void => {
  const n = pts.length;
  const at = (i: number) => pts[((i % n) + n) % n];
  ctx.moveTo(pts[0][0], pts[0][1]);
  for (let i = 0; i < n; i++) {
    const p0 = at(i - 1);
    const p1 = at(i);
    const p2 = at(i + 1);
    const p3 = at(i + 2);
    ctx.bezierCurveTo(
      p1[0] + (p2[0] - p0[0]) * tension,
      p1[1] + (p2[1] - p0[1]) * tension,
      p2[0] - (p3[0] - p1[0]) * tension,
      p2[1] - (p3[1] - p1[1]) * tension,
      p2[0],
      p2[1],
    );
  }
  ctx.closePath();
};

/** Emits an open cardinal spline through `pts` (no closing segment). */
const openSpline = (
  ctx: CanvasRenderingContext2D,
  pts: P[],
  tension = 0.16,
): void => {
  const n = pts.length;
  const at = (i: number) => pts[Math.max(0, Math.min(n - 1, i))];
  ctx.moveTo(pts[0][0], pts[0][1]);
  for (let i = 0; i < n - 1; i++) {
    const p0 = at(i - 1);
    const p1 = at(i);
    const p2 = at(i + 1);
    const p3 = at(i + 2);
    ctx.bezierCurveTo(
      p1[0] + (p2[0] - p0[0]) * tension,
      p1[1] + (p2[1] - p0[1]) * tension,
      p2[0] - (p3[0] - p1[0]) * tension,
      p2[1] - (p3[1] - p1[1]) * tension,
      p2[0],
      p2[1],
    );
  }
};

/**
 * Strokes a polyline whose width varies between the given per-anchor
 * widths, as a filled polygon. Used for the stem and for carving the
 * fissures, both of which must taper.
 */
const fillVariableWidth = (
  ctx: CanvasRenderingContext2D,
  pts: P[],
  widths: number[],
  steps = 90,
): void => {
  const n = pts.length;
  const samples: { x: number; y: number; w: number }[] = [];
  for (let s = 0; s <= steps; s++) {
    const u = (s / steps) * (n - 1);
    const i = Math.min(n - 2, Math.floor(u));
    const t = u - i;
    // Catmull-Rom position so the centre line matches the spline above.
    const p0 = pts[Math.max(0, i - 1)];
    const p1 = pts[i];
    const p2 = pts[i + 1];
    const p3 = pts[Math.min(n - 1, i + 2)];
    const t2 = t * t;
    const t3 = t2 * t;
    const h = (a: number, b: number, c: number, d: number) =>
      0.5 *
      (2 * b + (c - a) * t + (2 * a - 5 * b + 4 * c - d) * t2 + (-a + 3 * b - 3 * c + d) * t3);
    samples.push({
      x: h(p0[0], p1[0], p2[0], p3[0]),
      y: h(p0[1], p1[1], p2[1], p3[1]),
      w: widths[i] + (widths[i + 1] - widths[i]) * t,
    });
  }
  ctx.beginPath();
  for (let s = 0; s < samples.length; s++) {
    const a = samples[Math.max(0, s - 1)];
    const b = samples[Math.min(samples.length - 1, s + 1)];
    const len = Math.hypot(b.x - a.x, b.y - a.y) || 1;
    const nx = -(b.y - a.y) / len;
    const ny = (b.x - a.x) / len;
    const x = samples[s].x + nx * samples[s].w * 0.5;
    const y = samples[s].y + ny * samples[s].w * 0.5;
    if (s === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  for (let s = samples.length - 1; s >= 0; s--) {
    const a = samples[Math.max(0, s - 1)];
    const b = samples[Math.min(samples.length - 1, s + 1)];
    const len = Math.hypot(b.x - a.x, b.y - a.y) || 1;
    const nx = -(b.y - a.y) / len;
    const ny = (b.x - a.x) / len;
    ctx.lineTo(samples[s].x - nx * samples[s].w * 0.5, samples[s].y - ny * samples[s].w * 0.5);
  }
  ctx.closePath();
  ctx.fill();
};

// ---------------------------------------------------------------- drawing

/** Fills the union of the four pieces. Assumes a brain-unit transform. */
const fillSilhouette = (ctx: CanvasRenderingContext2D): void => {
  ctx.fillStyle = "rgb(255,255,255)";

  ctx.beginPath();
  ctx.ellipse(
    CEREBELLUM.cx,
    CEREBELLUM.cy,
    CEREBELLUM.rx,
    CEREBELLUM.ry,
    CEREBELLUM.rot,
    0,
    Math.PI * 2,
  );
  ctx.fill();

  fillVariableWidth(ctx, STEM, STEM_WIDTHS);

  ctx.beginPath();
  closedSpline(ctx, CEREBRUM);
  ctx.fill();
};

/** Removes the two fissures from whatever is already drawn. */
const carveFissures = (ctx: CanvasRenderingContext2D): void => {
  ctx.save();
  ctx.globalCompositeOperation = "destination-out";
  ctx.fillStyle = "rgb(0,0,0)";
  fillVariableWidth(ctx, SYLVIAN_FISSURE, SYLVIAN_WIDTHS);
  fillVariableWidth(ctx, TRANSVERSE_FISSURE, TRANSVERSE_WIDTHS);
  ctx.restore();
};

// ------------------------------------------------------------------ gyri

export type Gyrus = { x: number; y: number }[];

const gradientAt = (
  field: Field,
  w: number,
  h: number,
  x: number,
  y: number,
): { gx: number; gy: number } => {
  const ix = Math.max(1, Math.min(w - 2, Math.round(x)));
  const iy = Math.max(1, Math.min(h - 2, Math.round(y)));
  return {
    gx: field[iy * w + ix + 1] - field[iy * w + ix - 1],
    gy: field[(iy + 1) * w + ix] - field[(iy - 1) * w + ix],
  };
};

const sampleAt = (field: Field, w: number, h: number, x: number, y: number): number => {
  const ix = Math.max(0, Math.min(w - 1, Math.round(x)));
  const iy = Math.max(0, Math.min(h - 1, Math.round(y)));
  return field[iy * w + ix];
};

/**
 * Walks one convolution: start tangential to the surface, then turn by a
 * curvature that is itself modulated, so the curve curls back on itself
 * rather than sweeping a clean arc.
 */
const walkGyrus = (
  rng: Rng,
  mask: Mask,
  distIn: Field,
  start: { x: number; y: number },
  scale: number,
): Gyrus => {
  const { width: w, height: h } = mask;
  const g = gradientAt(distIn, w, h, start.x, start.y);
  const glen = Math.hypot(g.gx, g.gy);
  // Perpendicular to the depth gradient = tangent to the surface.
  const tangent = glen > 1e-4 ? Math.atan2(g.gx, -g.gy) : rng() * Math.PI * 2;
  let heading = tangent + (rng() - 0.5) * 1.8;
  if (rng() < 0.5) heading += Math.PI;

  const step = range(rng, 13, 25) * scale;
  const steps = rangeInt(rng, 7, 18);
  const curl = (rng() < 0.5 ? -1 : 1) * range(rng, 0.02, 0.08);
  const wobbleAmp = range(rng, 0.03, 0.14);
  const wobbleFreq = range(rng, 0.35, 1.1);
  const wobblePhase = rng() * Math.PI * 2;

  const pts: Gyrus = [{ x: start.x, y: start.y }];
  let x = start.x;
  let y = start.y;
  for (let s = 0; s < steps; s++) {
    heading += curl + wobbleAmp * Math.sin(s * wobbleFreq + wobblePhase);
    const nx = x + Math.cos(heading) * step;
    const ny = y + Math.sin(heading) * step;
    if (nx < 1 || ny < 1 || nx >= w - 1 || ny >= h - 1) break;
    if (mask.alpha[Math.round(ny) * w + Math.round(nx)] < 128) break;
    if (sampleAt(distIn, w, h, nx, ny) < 2.5 * scale) break;
    x = nx;
    y = ny;
    pts.push({ x, y });
  }
  return pts;
};

/**
 * The cerebellum as leaf venation: a central spine along the long axis
 * with veins branching off both sides and sweeping toward the tip.
 *
 * Real cerebellar folia are fine parallel ridges, but at this size they
 * would sit below the particle lattice and read as noise. The radiating
 * pattern is the convention lateral brain line art uses, and it is what
 * separates the cerebellum from "another lobe" at a glance.
 */
const cerebellarFolia = (rng: Rng): Gyrus[] => {
  const cos = Math.cos(CEREBELLUM.rot);
  const sin = Math.sin(CEREBELLUM.rot);
  // Ellipse-local (u, v), each in [-1, 1], to brain units.
  const toUnits = (u: number, v: number): { x: number; y: number } => ({
    x: CEREBELLUM.cx + u * CEREBELLUM.rx * cos - v * CEREBELLUM.ry * sin,
    y: CEREBELLUM.cy + u * CEREBELLUM.rx * sin + v * CEREBELLUM.ry * cos,
  });

  const out: Gyrus[] = [];

  // The midrib, base (+u, toward the occipital) to tip (-u, forward).
  const spine: Gyrus = [];
  for (let s = 0; s <= 12; s++) {
    const t = s / 12;
    spine.push(toUnits(0.88 - t * 1.74, Math.sin(t * Math.PI) * 0.12));
  }
  out.push(spine);

  for (let k = 0; k < CEREBELLUM_FOLIA_COUNT; k++) {
    const u0 = 0.62 - (k / (CEREBELLUM_FOLIA_COUNT - 1)) * 1.14 + (rng() - 0.5) * 0.05;
    const u1 = u0 - 0.34;
    for (let s = 0; s < 2; s++) {
      const side = s === 0 ? -1 : 1;
      const reach = Math.sqrt(Math.max(0, 1 - u1 * u1)) * (0.8 + rng() * 0.14);
      const vein: Gyrus = [];
      for (let i = 0; i <= 6; i++) {
        const t = i / 6;
        vein.push(toUnits(u0 + (u1 - u0) * t, side * reach * Math.pow(t, 0.72)));
      }
      out.push(vein);
    }
  }
  return out;
};

// -------------------------------------------------------------- assembly

export type BrainGeometry = {
  mask: Mask;
  /** Depth inside the silhouette, in mask pixels. */
  distIn: Field;
  /** Distance outside the silhouette, in mask pixels. */
  distOut: Field;
  /** 0..1 proximity to a gyral guide curve. */
  gyriField: Field;
  /** Position of mask pixel (0,0) in frame coordinates. */
  originX: number;
  originY: number;
  width: number;
  height: number;
  /** Frame pixels per brain unit. */
  scale: number;
  /** Silhouette centre in frame coordinates. */
  centerX: number;
  centerY: number;
};

/** Padding around the silhouette, for the particles that drift outside it. */
const PAD = 76;

/**
 * Builds every field the sampler needs, once. Call from useMemo — this
 * rasterises three canvases and runs two distance transforms.
 */
export const buildBrainGeometry = (
  targetHeight: number,
  centerX: number,
  centerY: number,
  seed: string,
): BrainGeometry => {
  const scale = targetHeight / UNIT_H;
  const pxW = Math.ceil(UNIT_W * scale);
  const pxH = Math.ceil(UNIT_H * scale);
  const width = pxW + PAD * 2;
  const height = pxH + PAD * 2;

  const toUnits = (ctx: CanvasRenderingContext2D) => {
    ctx.translate(PAD, PAD);
    ctx.scale(scale, scale);
    ctx.translate(-UNIT_MIN_X, -UNIT_MIN_Y);
  };

  const mask = renderMask(width, height, (ctx) => {
    ctx.save();
    toUnits(ctx);
    fillSilhouette(ctx);
    carveFissures(ctx);
    ctx.restore();
  });

  const distIn = distanceField(mask, true);
  const distOut = distanceField(mask, false);

  // Guide curves are walked in mask-pixel space so they can follow the
  // depth gradient directly.
  // The cerebellum has its own, quite different fold pattern, so keep the
  // cerebral guide curves out of it.
  const inCerebellum = (px: number, py: number): boolean => {
    const ux = UNIT_MIN_X + (px - PAD) / scale;
    const uy = UNIT_MIN_Y + (py - PAD) / scale;
    const dx = ux - CEREBELLUM.cx;
    const dy = uy - CEREBELLUM.cy;
    const c = Math.cos(-CEREBELLUM.rot);
    const sn = Math.sin(-CEREBELLUM.rot);
    const u = (dx * c - dy * sn) / CEREBELLUM.rx;
    const v = (dx * sn + dy * c) / CEREBELLUM.ry;
    return u * u + v * v <= 1;
  };

  // Seeds are placed on a jittered grid rather than sampled freely.
  // Pure random placement leaves conspicuous bald patches at this count,
  // and a bald patch in a particle field reads as a hole in the subject;
  // stratifying keeps coverage even while the jitter keeps it irregular.
  const rng = makeRng(seed + ":gyri");
  const seeds: { x: number; y: number }[] = [];
  const cell = Math.sqrt((pxW * pxH) / (GYRI_COUNT * 1.35));
  const cols = Math.max(1, Math.round(pxW / cell));
  const rows = Math.max(1, Math.round(pxH / cell));
  for (let gy = 0; gy < rows; gy++) {
    for (let gx = 0; gx < cols; gx++) {
      for (let tries = 0; tries < 12; tries++) {
        const x = PAD + ((gx + rng()) / cols) * pxW;
        const y = PAD + ((gy + rng()) / rows) * pxH;
        if (mask.alpha[Math.round(y) * width + Math.round(x)] < 128) continue;
        if (sampleAt(distIn, width, height, x, y) < 6 * scale) continue;
        if (inCerebellum(x, y)) continue;
        seeds.push({ x, y });
        break;
      }
    }
  }

  const gyri: Gyrus[] = [];
  for (let i = 0; i < seeds.length; i++) {
    const g = walkGyrus(rng, mask, distIn, seeds[i], scale);
    if (g.length >= 4) gyri.push(g);
  }

  // Cerebellar folia are authored in brain units, so convert them.
  const foliaRng = makeRng(seed + ":folia");
  const folia = cerebellarFolia(foliaRng).map((f) =>
    f.map((p) => ({
      x: PAD + (p.x - UNIT_MIN_X) * scale,
      y: PAD + (p.y - UNIT_MIN_Y) * scale,
    })),
  );

  // Soft proximity field: the same curves stroked at decreasing widths so
  // density falls off smoothly around them without needing a blur filter.
  const strokePasses: [number, number][] = [
    [34, 0.14],
    [24, 0.17],
    [17, 0.22],
    [11, 0.28],
    [6, 0.36],
  ];
  const gyriField = coverageField(width, height, (ctx) => {
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.strokeStyle = "rgb(255,255,255)";
    const drawSet = (set: Gyrus[], widthMul: number) => {
      for (let pass = 0; pass < strokePasses.length; pass++) {
        ctx.lineWidth = strokePasses[pass][0] * scale * widthMul;
        ctx.globalAlpha = strokePasses[pass][1];
        for (let i = 0; i < set.length; i++) {
          const pts = set[i].map((p): P => [p.x, p.y]);
          ctx.beginPath();
          openSpline(ctx, pts, 0.2);
          ctx.stroke();
        }
      }
    };
    drawSet(gyri, 1);
    // The venation must be drawn wider than the particle lattice or it falls
    // straight through the gaps; a second narrower pass sharpens its spine.
    drawSet(folia, 0.7);
    drawSet(folia, 0.42);
  });

  return {
    mask,
    distIn,
    distOut,
    gyriField,
    originX: centerX - width / 2,
    originY: centerY - height / 2,
    width,
    height,
    scale,
    centerX,
    centerY,
  };
};
