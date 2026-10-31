// Looks 7-8 · Unknown Person: head-and-shoulders silhouettes made of tangled
// white scribble loops (Rough.js zigzag fill + perfect-freehand loops), with
// a white scribble disc for a face and a hand-drawn black "?".
import { makeCanvas, type DrawFn } from "../lib/CanvasHost";
import { freehand } from "../lib/freehand";
import { clamp, lerp, mod, polyPath, resample, smoothstep, TAU, type Pt } from "../lib/math";
import { roughFill } from "../lib/rough";
import { makeRng, seedFor, type Rng } from "../lib/rng";

// ---- data ------------------------------------------------------------------
export const FIGURE = {
  line: "#F5F5F5",
  cycleHeight: 0.6, // look 7: figure height, fraction of frame height
  lineupHeight: 0.55, // look 8
  lineupX: [0.215, 0.5, 0.785], // look 8: figure centres, fraction of width
  changeEvery: 100, // look 7: frames per figure
  changeFrames: 8, // look 7: re-scribble duration
  flares: [
    // look 8: [figure, start frame, length]
    [0, 36, 12],
    [2, 128, 12],
    [1, 214, 12],
  ] as [number, number, number][],
  boilHold: 3,
  boilVariants: 4,
  bloomPx: 5, // tight bloom under the lines, at 4K
  bloomAlpha: 0.22,
};

const W = 3840;
const H = 2160;
const LOOP = 300;

type FigureDef = {
  right: Pt[]; // right half of the outline, bottom -> top centre (units)
  face: Pt; // face disc centre
  faceR: number;
  hairY: number; // hairline (y in units): above it the loops run like hair
  spiky?: boolean;
  strands?: number; // loose hair strands
  longHair?: boolean;
};

// Units: 0 = top of the head, 1 = bottom of the frame; x = 0 on the centre line.
export const FIGURES: FigureDef[] = [
  // A: short neat hair, narrow shoulders.
  {
    right: [
      [0.3, 1.04], [0.305, 0.84], [0.298, 0.68], [0.268, 0.585], [0.19, 0.535], [0.098, 0.508],
      [0.07, 0.462], [0.066, 0.395], [0.086, 0.348], [0.117, 0.296], [0.132, 0.215], [0.138, 0.135],
      [0.127, 0.072], [0.09, 0.026], [0.038, 0.004], [0, 0],
    ],
    face: [0, 0.215],
    faceR: 0.088,
    hairY: 0.105,
  },
  // B: longer hair falling to the shoulders.
  {
    right: [
      [0.325, 1.04], [0.33, 0.82], [0.32, 0.665], [0.29, 0.58], [0.245, 0.545], [0.212, 0.53],
      [0.205, 0.46], [0.197, 0.37], [0.183, 0.27], [0.172, 0.17], [0.152, 0.09], [0.108, 0.033],
      [0.045, 0.002], [0, -0.004],
    ],
    face: [0, 0.225],
    faceR: 0.09,
    hairY: 0.12,
    longHair: true,
    strands: 5,
  },
  // C: wild spiky hair with loose strands.
  {
    right: [
      [0.345, 1.04], [0.35, 0.82], [0.342, 0.67], [0.31, 0.582], [0.24, 0.535], [0.11, 0.508],
      [0.075, 0.462], [0.07, 0.395], [0.09, 0.348], [0.12, 0.296], [0.137, 0.215], [0.158, 0.15],
      [0.17, 0.085], [0.135, 0.02], [0.065, -0.012], [0, -0.018],
    ],
    face: [0, 0.225],
    faceR: 0.088,
    hairY: 0.14,
    spiky: true,
    strands: 11,
  },
];

// Catmull-Rom through points (closed).
const catmull = (pts: Pt[], steps: number): Pt[] => {
  const out: Pt[] = [];
  const n = pts.length;
  for (let i = 0; i < n; i++) {
    const p0 = pts[(i - 1 + n) % n];
    const p1 = pts[i];
    const p2 = pts[(i + 1) % n];
    const p3 = pts[(i + 2) % n];
    for (let k = 0; k < steps; k++) {
      const t = k / steps;
      const t2 = t * t;
      const t3 = t2 * t;
      out.push([
        0.5 * (2 * p1[0] + (-p0[0] + p2[0]) * t + (2 * p0[0] - 5 * p1[0] + 4 * p2[0] - p3[0]) * t2 + (-p0[0] + 3 * p1[0] - 3 * p2[0] + p3[0]) * t3),
        0.5 * (2 * p1[1] + (-p0[1] + p2[1]) * t + (2 * p0[1] - 5 * p1[1] + 4 * p2[1] - p3[1]) * t2 + (-p0[1] + 3 * p1[1] - 3 * p2[1] + p3[1]) * t3),
      ]);
    }
  }
  return out;
};

const N_OUTLINE = 260;

// Full closed outline in units, starting at the bottom right, with small
// seeded wobble (variant offsets) and spikes for figure C.
export const figureOutline = (def: FigureDef, rng: Rng | null, wob: number): Pt[] => {
  const R = def.right;
  const left = R.slice(0, -1).reverse().map(([x, y]): Pt => [-x, y]);
  const ctrl = [...R, ...left].map(([x, y]): Pt =>
    rng ? [x + rng.gauss() * wob, y + rng.gauss() * wob * (y > 0.9 ? 0 : 1)] : [x, y],
  );
  // Heads are drawn a little large (a scribble head reads bigger than life).
  const headScale = (y: number) => 1 + 0.2 * clamp((0.44 - y) / 0.1);
  let pts = resample(catmull(ctrl.map(([x, y]): Pt => [x * headScale(y), y]), 8), N_OUTLINE, true);
  if (def.spiky) {
    const sr = makeRng("spikes"); // same spike layout for every variant
    const head: Pt = [0, 0.2];
    let phase = 0;
    pts = pts.map(([x, y], i) => {
      if (y > def.hairY + 0.03) return [x, y];
      const a = Math.atan2(y - head[1], x - head[0]);
      const k = smoothstep((def.hairY + 0.03 - y) / 0.06);
      phase = i;
      const spike = Math.max(0, Math.sin(a * 11 + 0.6)) ** 3;
      const amp = 0.04 * k * (0.7 + 0.6 * Math.abs(Math.sin(a * 5.3 + 1.7)));
      const j = rng ? rng.gauss() * 0.004 : 0;
      return [x + Math.cos(a) * (spike * amp + j), y + Math.sin(a) * (spike * amp + j)];
    });
    void sr;
    void phase;
  }
  return pts;
};

const inside = (pts: Pt[], x: number, y: number) => {
  let c = false;
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    const [xi, yi] = pts[i];
    const [xj, yj] = pts[j];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) c = !c;
  }
  return c;
};

// Loops along a guide polyline (prolate trochoid): the pen circles while it
// travels, like a fast scribble.
const loopsAlong = (
  guide: Pt[],
  r: number,
  advance: number,
  rng: Rng,
  flyout = 0,
  outward?: (p: Pt) => Pt,
): Pt[] => {
  const g = resample(guide, Math.max(2, Math.ceil(lengthOf(guide) / (advance / 9))), false);
  const out: Pt[] = [];
  let phi = rng.range(0, TAU);
  let rr = r;
  let fly = 0;
  let asp = 1; // each loop is an ellipse of its own shape and tilt
  let tilt = 0;
  for (let i = 0; i < g.length; i++) {
    phi += TAU / 9 + rng.gauss() * 0.12;
    if (i % 9 === 0) {
      rr = r * rng.range(0.45, 1.6);
      asp = rng.range(0.45, 1);
      tilt = rng.range(0, Math.PI);
      fly = rng.next() < flyout ? rng.range(1.6, 3.2) : 1;
    }
    const [gx, gy] = g[i];
    let ox = 0;
    let oy = 0;
    if (fly > 1 && outward) {
      const [nx, ny] = outward(g[i]);
      ox = nx * rr * (fly - 1);
      oy = ny * rr * (fly - 1);
    }
    const wob = 1 + 0.18 * Math.sin(phi * 2.3 + i * 0.7);
    const ex = Math.cos(phi) * rr * wob * (fly > 1 ? fly * 0.7 : 1);
    const ey = Math.sin(phi) * rr * asp * (fly > 1 ? 1.3 : 1) / wob;
    out.push([gx + ex * Math.cos(tilt) - ey * Math.sin(tilt) + ox, gy + ex * Math.sin(tilt) + ey * Math.cos(tilt) + oy]);
  }
  return out;
};

const lengthOf = (p: Pt[]) => {
  let s = 0;
  for (let i = 1; i < p.length; i++) s += Math.hypot(p[i][0] - p[i - 1][0], p[i][1] - p[i - 1][1]);
  return s;
};

// Splits a long point run into pen strokes of varying length.
const penStrokes = (pts: Pt[], rng: Rng, minLen = 40, maxLen = 140) => {
  const out: Pt[][] = [];
  let i = 0;
  while (i < pts.length - 3) {
    const n = rng.int(minLen, maxLen);
    out.push(pts.slice(i, Math.min(pts.length, i + n + 2)));
    i += n;
  }
  return out;
};

export type ScribbleParams = {
  wild: number; // 0 = settled, 1 = tangled wildly
};

// Draws one figure (outline in px, face in px) onto ctx with the current
// transform. `seedParts` makes each variant a fresh scribble.
export const drawFigureScribble = (
  ctx: CanvasRenderingContext2D,
  outline: Pt[],
  face: Pt,
  faceR: number,
  def: FigureDef,
  s: number, // px per unit
  seedParts: (string | number)[],
  p: ScribbleParams,
) => {
  const rng = makeRng(...seedParts, "scribble");
  const k = s / 1296; // line widths scale with figure size
  const wild = p.wild;
  ctx.fillStyle = FIGURE.line;
  ctx.strokeStyle = FIGURE.line;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";

  // Centroid-relative outward direction for flying loops.
  const cx = 0;
  const cy = (face[1] + outline.reduce((a, q) => a + q[1], 0) / outline.length) / 2;
  const outward = ([x, y]: Pt): Pt => {
    const n = Math.hypot(x - cx, y - cy) || 1;
    return [(x - cx) / n, (y - cy) / n];
  };

  // 1. Rough.js zigzag scribble fill of the silhouette, two directions.
  const body = outline;
  // (Loose and curvy: it reads as under-scribble, the loops do the rest.)
  for (let pass = 0; pass < 1; pass++) {
    const path = roughFill(body, {
      fillStyle: "zigzag",
      hachureGap: 95 * k * (1 + wild * 0.6),
      hachureAngle: rng.pick([-1, 1]) * rng.range(25, 50),
      fillWeight: 6 * k,
      roughness: 6 + wild * 3,
      bowing: 16,
      seed: seedFor(...seedParts, "fill", pass),
    });
    ctx.lineWidth = 8 * k;
    ctx.globalAlpha = 0.4;
    ctx.stroke(path);
  }
  ctx.globalAlpha = 1;

  // 2. Interior tangles: loopy random walks inside the silhouette.
  ctx.save();
  ctx.clip(polyPath(body));
  const walkers = 8;
  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
  for (const [x, y] of body) {
    minX = Math.min(minX, x); maxX = Math.max(maxX, x);
    minY = Math.min(minY, y); maxY = Math.max(maxY, y);
  }
  for (let wk = 0; wk < walkers; wk++) {
    let x = 0, y = 0;
    for (let t = 0; t < 50; t++) {
      // The first few walks start in the head so it is always filled.
      x = wk < 3 ? rng.range(-0.12, 0.12) * s : rng.range(minX, maxX);
      y = wk < 3 ? minY + rng.range(0.04, 0.3) * s : rng.range(minY, maxY);
      if (inside(body, x, y)) break;
    }
    const guide: Pt[] = [[x, y]];
    let ang = rng.range(0, TAU);
    const hair = y < def.hairY * s + minY + 0.02 * s;
    for (let st = 0; st < 22; st++) {
      ang += rng.gauss() * 0.5;
      if (def.longHair && hair) ang = Math.PI / 2 + rng.gauss() * 0.3;
      const nx = x + Math.cos(ang) * 75 * k;
      const ny = y + Math.sin(ang) * 75 * k;
      if (!inside(body, nx, ny)) {
        ang += Math.PI * rng.range(0.6, 1.4);
        continue;
      }
      x = nx;
      y = ny;
      guide.push([x, y]);
    }
    if (guide.length < 3) continue;
    const loops = loopsAlong(guide, rng.range(60, 110) * k * (1 + wild * 1.5), 110 * k, rng);
    for (const st of penStrokes(loops, rng)) {
      ctx.fill(freehand(st, { size: rng.range(20, 32) * k, thinning: 0.2, smoothing: 0.4, streamline: 0.2 }));
    }
  }
  ctx.restore();

  // 3. Loops along the outline, some flying out past it.
  const ring = [...outline, outline[0]];
  for (let pass = 0; pass < 2; pass++) {
    const shifted = ring.map(([x, y]): Pt => {
      const [nx, ny] = outward([x, y]);
      const inset = pass === 0 ? -6 * k : 18 * k;
      return [x - nx * inset, y - ny * inset];
    });
    const loops = loopsAlong(shifted, (pass === 0 ? 46 : 66) * k * (1 + wild * 2), 58 * k, rng, 0.05 + wild * 0.4, outward);
    for (const st of penStrokes(loops, rng, 30, 120)) {
      ctx.fill(freehand(st, { size: rng.range(18, 28) * k, thinning: 0.2, smoothing: 0.45, streamline: 0.25 }));
    }
  }

  // 4. Loose strands (B), long straight spikes radiating from the head (C).
  const radial = ([x, y]: Pt): Pt => {
    const hx = 0, hy = minY + 0.2 * s;
    const n = Math.hypot(x - hx, y - hy) || 1;
    return [(x - hx) / n, (y - hy) / n];
  };
  for (let i = 0; i < (def.strands ?? 0); i++) {
    const top = outline.filter(([, y]) => y < minY + (def.longHair ? 0.55 : def.spiky ? 0.3 : 0.16) * s);
    const [sx, sy] = top[Math.floor(rng.next() * top.length)];
    const [nx, ny] = def.spiky ? radial([sx, sy]) : outward([sx, sy]);
    const len = rng.range(def.spiky ? 0.1 : 0.06, def.spiky ? 0.22 : 0.11) * s * (1 + wild);
    const bend = rng.gauss() * (def.spiky ? 0.12 : 0.6);
    const pts: Pt[] = [];
    for (let j = 0; j <= 8; j++) {
      const t = j / 8;
      const a = Math.atan2(ny, nx) + bend * t;
      pts.push([sx - nx * 12 * k + Math.cos(a) * len * t, sy - ny * 12 * k + Math.sin(a) * len * t]);
    }
    ctx.fill(freehand(pts, { size: rng.range(def.spiky ? 26 : 12, def.spiky ? 40 : 18) * k, thinning: 0.35, smoothing: 0.5, start: { taper: 0 }, end: { taper: len * 0.25 } }));
  }

  // 5. Face: a dark gap, a dense white scribble disc, a black "?".
  const [fx, fy] = face;
  const R = faceR;
  const discPts: Pt[] = [];
  for (let i = 0; i < 14; i++) discPts.push([fx + Math.cos((i / 14) * TAU) * R, fy + Math.sin((i / 14) * TAU) * R]);
  ctx.lineWidth = 7 * k;
  for (let pass = 0; pass < 1; pass++) {
    ctx.stroke(
      roughFill(discPts, {
        fillStyle: "zigzag",
        hachureGap: 30 * k,
        hachureAngle: pass ? rng.range(30, 60) : rng.range(-60, -30),
        fillWeight: 5 * k,
        roughness: 3 + wild * 3,
        bowing: 6,
        seed: seedFor(...seedParts, "disc", pass),
      }),
    );
  }
  for (let ringI = 0; ringI < 4; ringI++) {
    const rr = R * (0.3 + ringI * 0.22);
    const circ: Pt[] = [];
    for (let i = 0; i <= 40; i++) {
      const a = (i / 40) * TAU;
      circ.push([fx + Math.cos(a) * rr, fy + Math.sin(a) * rr]);
    }
    const loops = loopsAlong(circ, 34 * k * (1 + wild * 2), 34 * k, rng);
    for (const st of penStrokes(loops, rng, 60, 160)) {
      ctx.fill(freehand(st, { size: rng.range(16, 24) * k, thinning: 0.2, smoothing: 0.4 }));
    }
  }
  // Overlapping strokes blow out to a white core behind the "?".
  const core = ctx.createRadialGradient(fx, fy, 0, fx, fy, R * 1.05);
  core.addColorStop(0, "rgba(245,245,245,1)");
  core.addColorStop(0.6, "rgba(245,245,245,0.85)");
  core.addColorStop(1, "rgba(245,245,245,0)");
  ctx.fillStyle = core;
  ctx.beginPath();
  ctx.arc(fx, fy, R * 1.05, 0, TAU);
  ctx.fill();
  ctx.fillStyle = FIGURE.line;
  if (wild < 0.6) {
    const qa = 1 - smoothstep((wild - 0.3) / 0.3);
    const q = R * 1.1;
    const j = () => rng.gauss() * 0.025 * q;
    const hook: Pt[] = [
      [-0.55, -0.42], [-0.45, -0.75], [-0.1, -0.95], [0.32, -0.88], [0.55, -0.6], [0.48, -0.3],
      [0.18, -0.08], [0.02, 0.12], [0.0, 0.38],
    ].map(([x, y]): Pt => [fx + x * q + j(), fy + y * q + j()]);
    ctx.save();
    ctx.globalAlpha = qa;
    ctx.globalCompositeOperation = "destination-out";
    ctx.fill(freehand(hook, { size: q * 0.48, thinning: 0.45, smoothing: 0.6, streamline: 0.3, start: { taper: q * 0.4 }, end: { taper: 0 } }));
    ctx.beginPath();
    ctx.ellipse(fx + j(), fy + q * 0.74 + j(), q * 0.18, q * 0.17, rng.range(0, 1), 0, TAU);
    ctx.fill();
    ctx.restore();
  }
};

// Px geometry of figure i at size s (px per unit), centred on x = 0, top at y = 0.
const figureGeom = (i: number, s: number, rng: Rng | null) => {
  const def = FIGURES[i];
  const outline = figureOutline(def, rng, 0.004).map(([x, y]): Pt => [x * s, y * s]);
  const face: Pt = [def.face[0] * s + (rng ? rng.gauss() * 0.003 * s : 0), def.face[1] * s + (rng ? rng.gauss() * 0.003 * s : 0)];
  return { def, outline, face, faceR: def.faceR * s };
};

// Pre-rendered boil variants for a figure at a given size.
type Variant = { c: HTMLCanvasElement; ox: number; oy: number; w: number; h: number };
const variantCache = new Map<string, Variant>();
const getVariant = (id: string, i: number, v: number, s: number, dpr: number): Variant => {
  const key = `${id}:${i}:${v}:${s}:${dpr}`;
  const hit = variantCache.get(key);
  if (hit) return hit;
  const rng = makeRng(id, "fig", i, v);
  const g = figureGeom(i, s, rng);
  const w = s * 1.2;
  const h = s * 1.25;
  const ox = w / 2;
  const oy = s * 0.18; // room above the head for spikes / flying loops
  const { c, ctx } = makeCanvas(w * dpr, h * dpr);
  ctx.setTransform(dpr, 0, 0, dpr, ox * dpr, oy * dpr);
  drawFigureScribble(ctx, g.outline, g.face, g.faceR, g.def, s, [id, "fig", i, v], { wild: 0 });
  const out = { c, ox, oy, w, h };
  variantCache.set(key, out);
  return out;
};

// A tight bloom under the lines (overlaps merge, edges soften), then the lines.
const blitVariant = (ctx: CanvasRenderingContext2D, vr: Variant, x: number, top: number, dpr = 1) => {
  ctx.save();
  ctx.filter = `blur(${FIGURE.bloomPx * dpr}px)`;
  ctx.globalAlpha = FIGURE.bloomAlpha;
  ctx.drawImage(vr.c, x - vr.ox, top - vr.oy, vr.w, vr.h);
  ctx.restore();
  ctx.drawImage(vr.c, x - vr.ox, top - vr.oy, vr.w, vr.h);
};

// Live drawing (transitions / flares), straight onto the frame.
const drawLive = (
  ctx: CanvasRenderingContext2D,
  dpr: number,
  x: number,
  top: number,
  s: number,
  outline: Pt[],
  face: Pt,
  faceR: number,
  def: FigureDef,
  seedParts: (string | number)[],
  wild: number,
) => {
  ctx.save();
  ctx.setTransform(dpr, 0, 0, dpr, x * dpr, top * dpr);
  drawFigureScribble(ctx, outline, face, faceR, def, s, seedParts, { wild });
  ctx.restore();
};

// Outlines resampled from the same start (bottom right) so they morph.
const outlinePx = (i: number, s: number) => figureGeom(i, s, null);

// ---- Look 7 ----------------------------------------------------------------
export const makeUnknownCycle = (id: string): DrawFn => {
  const s = H * FIGURE.cycleHeight;
  const top = H - s;
  const x = W / 2;
  return (ctx, frame, { dpr }) => {
    const f = mod(frame, LOOP);
    const seg = Math.floor(f / FIGURE.changeEvery); // 0,1,2 -> A,B,C
    const k = f - seg * FIGURE.changeEvery - (FIGURE.changeEvery - FIGURE.changeFrames);
    const v = mod(Math.floor(frame / FIGURE.boilHold), FIGURE.boilVariants);
    if (k < 0) {
      blitVariant(ctx, getVariant(id, seg, v, s, dpr), x, top, dpr);
      return;
    }
    // Re-scribble: tangle wildly, settle into the next figure (on twos).
    const kq = k - (k % 2);
    const t = (kq + 1) / FIGURE.changeFrames;
    const from = outlinePx(seg, s);
    const to = outlinePx((seg + 1) % 3, s);
    const m = smoothstep(t);
    const outline = from.outline.map(([ax, ay], n): Pt => [lerp(ax, to.outline[n][0], m), lerp(ay, to.outline[n][1], m)]);
    const face: Pt = [lerp(from.face[0], to.face[0], m), lerp(from.face[1], to.face[1], m)];
    const wild = Math.sin(Math.PI * t);
    const def = m < 0.5 ? from.def : to.def;
    drawLive(ctx, dpr, x, top, s, outline, face, lerp(from.faceR, to.faceR, m), def, [id, "morph", seg, kq], wild);
  };
};

// ---- Look 8 ----------------------------------------------------------------
export const makeUnknownLineup = (id: string): DrawFn => {
  const s = H * FIGURE.lineupHeight;
  const top = H - s;
  return (ctx, frame, { dpr }) => {
    const f = mod(frame, LOOP);
    for (let i = 0; i < 3; i++) {
      const x = W * FIGURE.lineupX[i];
      // Out of step: each figure changes drawing on a different frame.
      const v = mod(Math.floor((frame + i) / FIGURE.boilHold), FIGURE.boilVariants);
      const flare = FIGURE.flares.find(([fi, st, len]) => fi === i && f >= st && f < st + len);
      if (flare) {
        const kq = f - flare[1] - ((f - flare[1]) % 2);
        const wild = 0.75 * Math.sin((Math.PI * (kq + 1)) / flare[2]);
        const g = figureGeom(i, s, makeRng(id, "flare", i, kq));
        drawLive(ctx, dpr, x, top, s, g.outline, g.face, g.faceR, g.def, [id, "flare", i, kq], clamp(wild));
      } else {
        blitVariant(ctx, getVariant(id, i, v, s, dpr), x, top, dpr);
      }
    }
  };
};

export const drawUnknownCycle = makeUnknownCycle("UnknownPerson_Cycle");
export const drawUnknownLineup = makeUnknownLineup("UnknownPerson_Lineup");
