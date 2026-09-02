/**
 * The subject: a brain in three-quarter view, facing left.
 *
 * The silhouette is authored in "brain units" (a hand-tuned 822x654 box)
 * and scaled to pixels once. It is the union of four filled pieces —
 * a near cerebral hemisphere, a far hemisphere sitting up and behind it,
 * a cerebellum tucked under the posterior, and a descending stem — with
 * two fissures then CARVED OUT of the result:
 *
 *  - the longitudinal fissure, running front-to-back along the crease
 *    where the near hemisphere's crown meets the far one. Because the
 *    view is three-quarter we look slightly down onto the top surface, so
 *    the far hemisphere shows as a crescent above the fissure.
 *  - the transverse fissure, separating the cerebellum from the cerebrum.
 *
 * Carving rather than shading matters: the gap is absent from the mask,
 * so no particle can ever land in it and the split stays legible.
 *
 * The gyri are NOT drawn. They are generated as guide curves and used
 * only to weight particle density, so the folds emerge from where the
 * particles crowd. Each curve starts at a seeded interior point, sets off
 * roughly tangential to the nearest surface (the direction real
 * convolutions run) with up to ~50 degrees of seeded deviation, and then
 * walks with a curvature that itself wobbles — so they curl and wander
 * instead of stacking into parallel bands, and the two hemispheres never
 * mirror each other.
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
export const UNIT_MIN_X = 104;
export const UNIT_MIN_Y = 190;
export const UNIT_MAX_X = 918;
export const UNIT_MAX_Y = 852;
export const UNIT_W = UNIT_MAX_X - UNIT_MIN_X;
export const UNIT_H = UNIT_MAX_Y - UNIT_MIN_Y;

/**
 * Near hemisphere, clockwise from the frontal pole. The kink around
 * (262, 508) is the notch above the temporal pole where the frontal
 * lobe's underside sweeps back.
 */
const NEAR_HEMISPHERE: P[] = [
  [110, 424],
  [134, 350],
  [206, 292],
  [316, 256],
  [438, 240],
  [566, 248],
  [700, 288],
  [826, 372],
  [896, 470],
  [886, 548],
  [804, 600],
  [690, 622],
  [566, 664],
  [452, 686],
  [330, 672],
  [252, 622],
  [228, 570],
  [244, 516],
  [166, 468],
];

/** Far hemisphere: an ovoid offset up and back, exposed as a crescent. */
const FAR_HEMISPHERE = { cx: 572, cy: 388, rx: 340, ry: 190, rot: -0.04 };

/** Cerebellum: narrow, tucked under the occipital pole. */
const CEREBELLUM = { cx: 770, cy: 662, rx: 162, ry: 104, rot: 0.2 };

/** Brainstem, descending anterior to the cerebellum. */
const STEM: P[] = [
  [648, 600],
  [642, 690],
  [628, 776],
  [612, 844],
];
const STEM_WIDTHS = [96, 82, 66, 52];

/** Longitudinal fissure: the crease between the two hemispheres. */
const LONGITUDINAL_FISSURE: P[] = [
  [258, 308],
  [356, 276],
  [464, 258],
  [576, 264],
  [692, 300],
  [800, 372],
  [870, 456],
];
const LONGITUDINAL_WIDTHS = [4, 14, 21, 22, 19, 13, 7];

/** Transverse fissure: cerebrum above, cerebellum below. */
const TRANSVERSE_FISSURE: P[] = [
  [612, 646],
  [700, 616],
  [794, 612],
  [896, 644],
];
const TRANSVERSE_WIDTHS = [5, 19, 19, 7];

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
    FAR_HEMISPHERE.cx,
    FAR_HEMISPHERE.cy,
    FAR_HEMISPHERE.rx,
    FAR_HEMISPHERE.ry,
    FAR_HEMISPHERE.rot,
    0,
    Math.PI * 2,
  );
  ctx.fill();

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
  closedSpline(ctx, NEAR_HEMISPHERE);
  ctx.fill();
};

/** Removes the two fissures from whatever is already drawn. */
const carveFissures = (ctx: CanvasRenderingContext2D): void => {
  ctx.save();
  ctx.globalCompositeOperation = "destination-out";
  ctx.fillStyle = "rgb(0,0,0)";
  fillVariableWidth(ctx, LONGITUDINAL_FISSURE, LONGITUDINAL_WIDTHS);
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

/** Fine parallel folia across the cerebellum, in brain units. */
const cerebellarFolia = (rng: Rng): Gyrus[] => {
  const out: Gyrus[] = [];
  const cos = Math.cos(CEREBELLUM.rot);
  const sin = Math.sin(CEREBELLUM.rot);
  for (let k = 0; k < CEREBELLUM_FOLIA_COUNT; k++) {
    const v =
      (-0.72 + (k / (CEREBELLUM_FOLIA_COUNT - 1)) * 1.44 + (rng() - 0.5) * 0.09) *
      CEREBELLUM.ry;
    const half = Math.sqrt(Math.max(0, 1 - (v / CEREBELLUM.ry) ** 2)) * CEREBELLUM.rx * 0.86;
    if (half < 12) continue;
    const bow = (rng() - 0.5) * 26;
    const pts: Gyrus = [];
    for (let s = 0; s <= 10; s++) {
      const t = s / 10;
      const u = -half + t * half * 2;
      const vv = v + bow * Math.sin(Math.PI * t);
      pts.push({
        x: CEREBELLUM.cx + u * cos - vv * sin,
        y: CEREBELLUM.cy + u * sin + vv * cos,
      });
    }
    out.push(pts);
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

  // The far-hemisphere crescent is a thin band and would otherwise get
  // only a couple of curves by area; give it a few short ones of its own.
  const crescentRng = makeRng(seed + ":crescent");
  let crescentPlaced = 0;
  let crescentAttempts = 0;
  while (crescentPlaced < 5 && crescentAttempts < 4000) {
    crescentAttempts++;
    const x = PAD + crescentRng() * pxW;
    const y = PAD + crescentRng() * (pxH * 0.22);
    if (mask.alpha[Math.round(y) * width + Math.round(x)] < 128) continue;
    if (sampleAt(distIn, width, height, x, y) < 5 * scale) continue;
    const g = walkGyrus(crescentRng, mask, distIn, { x, y }, scale * 0.62);
    if (g.length < 4) continue;
    gyri.push(g);
    crescentPlaced++;
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
    drawSet(folia, 0.36);
    // A second pass: fine parallel folia are the cerebellum's signature and
    // need to survive next to the much larger cerebral folds.
    drawSet(folia, 0.22);
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
