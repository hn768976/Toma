import type { Board, Trace } from "./board";
import { GRID, OVERSCAN, TIER_WIDTHS, type Palette } from "./constants";
import type { Lut } from "./color";
import { mulberry32 } from "./random";

export const TAIL_STEPS = 16;

// ---------------------------------------------------------------------------
// Static board layer
// ---------------------------------------------------------------------------

/**
 * Draws the unlit board once, into a canvas that is OVERSCAN larger than the
 * frame on every side. The routing is fixed geometry, so this is generated once
 * per resolution and then just blitted at the camera offset each frame.
 */
export const drawBaseBoard = (
  ctx: CanvasRenderingContext2D,
  board: Board,
  lut: Lut,
  palette: Palette,
  scale: number,
) => {
  const w = ctx.canvas.width;
  const h = ctx.canvas.height;
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.fillStyle = palette.background;
  ctx.fillRect(0, 0, w, h);

  ctx.setTransform(scale, 0, 0, scale, OVERSCAN * scale, OVERSCAN * scale);

  // Faint substrate mottling — enough to stop the background reading as a flat
  // fill, not enough to read as a material.
  for (const m of board.mottle) {
    const g = ctx.createRadialGradient(m.x, m.y, 0, m.x, m.y, m.r);
    g.addColorStop(0, palette.mottle);
    g.addColorStop(1, "rgba(0,0,0,0)");
    ctx.globalAlpha = m.a;
    ctx.fillStyle = g;
    ctx.fillRect(m.x - m.r, m.y - m.r, m.r * 2, m.r * 2);
  }
  ctx.globalAlpha = 1;

  // Traces, batched by (colour bucket, width tier) so the stroke style is set
  // once per group rather than once per segment.
  ctx.lineJoin = "miter";
  ctx.miterLimit = 3;
  ctx.lineCap = "round";
  const groups = new Map<number, Trace[]>();
  for (const t of board.traces) {
    const key = t.bucket * TIER_WIDTHS.length + t.tier;
    const list = groups.get(key);
    if (list) list.push(t);
    else groups.set(key, [t]);
  }
  for (const [key, list] of groups) {
    const bucket = Math.floor(key / TIER_WIDTHS.length);
    ctx.strokeStyle = lut.unlit[bucket];
    ctx.lineWidth = TIER_WIDTHS[key % TIER_WIDTHS.length];
    ctx.beginPath();
    for (const t of list) {
      ctx.moveTo(t.xs[0], t.ys[0]);
      for (let i = 1; i < t.xs.length; i++) ctx.lineTo(t.xs[i], t.ys[i]);
    }
    ctx.stroke();
  }

  // Vias, batched the same way.
  const viaGroups = new Map<number, Trace[]>();
  for (const t of board.traces) {
    const list = viaGroups.get(t.bucket);
    if (list) list.push(t);
    else viaGroups.set(t.bucket, [t]);
  }
  for (const [bucket, list] of viaGroups) {
    ctx.strokeStyle = lut.unlit[bucket];
    ctx.lineWidth = 2.2;
    ctx.beginPath();
    for (const t of list) {
      for (const n of t.nodes) {
        ctx.moveTo(n.x + n.r, n.y);
        ctx.arc(n.x, n.y, n.r, 0, Math.PI * 2);
      }
    }
    ctx.stroke();
  }

  drawComponents(ctx, board, lut);
  ctx.setTransform(1, 0, 0, 1, 0, 0);
};

const drawComponents = (ctx: CanvasRenderingContext2D, board: Board, lut: Lut) => {
  ctx.lineJoin = "miter";
  ctx.lineCap = "butt";

  for (const ic of board.ics) {
    const col = lut.outline[ic.bucket];
    // Pin comb first, so the body outline sits on top of the pin roots.
    ctx.strokeStyle = col;
    ctx.lineWidth = ic.pinW;
    ctx.beginPath();
    for (let i = 0; i < ic.pins; i++) {
      const o = (i - (ic.pins - 1) / 2) * GRID;
      ctx.moveTo(ic.cx - ic.half, ic.cy + o);
      ctx.lineTo(ic.cx - ic.pinTip, ic.cy + o);
      ctx.moveTo(ic.cx + ic.half, ic.cy + o);
      ctx.lineTo(ic.cx + ic.pinTip, ic.cy + o);
      ctx.moveTo(ic.cx + o, ic.cy - ic.half);
      ctx.lineTo(ic.cx + o, ic.cy - ic.pinTip);
      ctx.moveTo(ic.cx + o, ic.cy + ic.half);
      ctx.lineTo(ic.cx + o, ic.cy + ic.pinTip);
    }
    ctx.stroke();

    ctx.lineWidth = Math.max(2.4, ic.half * 0.012);
    ctx.beginPath();
    ctx.roundRect(ic.cx - ic.half, ic.cy - ic.half, ic.half * 2, ic.half * 2, ic.half * 0.06);
    ctx.stroke();
    const inset = ic.half * 0.86;
    ctx.lineWidth = Math.max(1.6, ic.half * 0.006);
    ctx.beginPath();
    ctx.roundRect(ic.cx - inset, ic.cy - inset, inset * 2, inset * 2, inset * 0.05);
    ctx.stroke();
    // Thermal pad and pin-1 marker.
    const pad = ic.half * 0.46;
    ctx.beginPath();
    ctx.roundRect(ic.cx - pad, ic.cy - pad, pad * 2, pad * 2, pad * 0.12);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(ic.cx - inset * 0.82, ic.cy - inset * 0.82, ic.half * 0.05, 0, Math.PI * 2);
    ctx.stroke();
  }

  ctx.lineWidth = 2.4;
  const padGroups = new Map<number, typeof board.pads>();
  for (const p of board.pads) {
    const list = padGroups.get(p.bucket);
    if (list) list.push(p);
    else padGroups.set(p.bucket, [p]);
  }
  for (const [bucket, list] of padGroups) {
    ctx.strokeStyle = lut.outline[bucket];
    ctx.beginPath();
    for (const p of list) ctx.roundRect(p.x - p.w / 2, p.y - p.h / 2, p.w, p.h, p.r);
    ctx.stroke();
  }

  const chipGroups = new Map<number, typeof board.chips>();
  for (const c of board.chips) {
    const list = chipGroups.get(c.bucket);
    if (list) list.push(c);
    else chipGroups.set(c.bucket, [c]);
  }
  for (const [bucket, list] of chipGroups) {
    ctx.strokeStyle = lut.outline[bucket];
    ctx.beginPath();
    for (const c of list) {
      ctx.rect(c.x - c.w / 2, c.y - c.h / 2, c.w, c.h);
      if (c.vertical) {
        ctx.rect(c.x - c.w / 2, c.y - c.h / 2, c.w, c.padW);
        ctx.rect(c.x - c.w / 2, c.y + c.h / 2 - c.padW, c.w, c.padW);
      } else {
        ctx.rect(c.x - c.w / 2, c.y - c.h / 2, c.padW, c.h);
        ctx.rect(c.x + c.w / 2 - c.padW, c.y - c.h / 2, c.padW, c.h);
      }
    }
    ctx.stroke();
  }

  ctx.setLineDash([9, 11]);
  ctx.lineWidth = 2;
  for (const d of board.dashes) {
    ctx.strokeStyle = lut.outline[d.bucket];
    ctx.beginPath();
    ctx.moveTo(d.x, d.y);
    if (d.vertical) ctx.lineTo(d.x, d.y + d.len);
    else ctx.lineTo(d.x + d.len, d.y);
    ctx.stroke();
  }
  ctx.setLineDash([]);
};

// ---------------------------------------------------------------------------
// Pulse layer
// ---------------------------------------------------------------------------

/** Index of the segment containing arc position s (cum[i] <= s <= cum[i+1]). */
const segmentAt = (cum: Float32Array, s: number) => {
  let lo = 0;
  let hi = cum.length - 2;
  while (lo < hi) {
    const mid = (lo + hi + 1) >> 1;
    if (cum[mid] <= s) lo = mid;
    else hi = mid - 1;
  }
  return lo;
};

/**
 * Strokes the piece of a trace between two arc positions, following every
 * vertex in between. Sampling the polyline at fixed intervals instead would cut
 * the corners off, and the mitred corners are the whole PCB read.
 */
const strokeRange = (ctx: CanvasRenderingContext2D, tr: Trace, a: number, b: number) => {
  if (b - a < 1e-3) return;
  const { xs, ys, cum } = tr;
  const n = xs.length;
  let i = segmentAt(cum, a);
  const span0 = Math.max(1e-6, cum[i + 1] - cum[i]);
  const t0 = (a - cum[i]) / span0;
  ctx.beginPath();
  ctx.moveTo(xs[i] + (xs[i + 1] - xs[i]) * t0, ys[i] + (ys[i + 1] - ys[i]) * t0);
  while (i + 1 < n - 1 && cum[i + 1] < b) {
    i++;
    ctx.lineTo(xs[i], ys[i]);
  }
  const span1 = Math.max(1e-6, cum[i + 1] - cum[i]);
  const t1 = Math.min(1, (b - cum[i]) / span1);
  ctx.lineTo(xs[i] + (xs[i + 1] - xs[i]) * t1, ys[i] + (ys[i + 1] - ys[i]) * t1);
  ctx.stroke();
};

/** Same, but splits a range that runs off the end of the path back to its start. */
const strokeWrapped = (ctx: CanvasRenderingContext2D, tr: Trace, a: number, b: number) => {
  const L = tr.length;
  if (b - a >= L) {
    strokeRange(ctx, tr, 0, L);
    return;
  }
  const a2 = ((a % L) + L) % L;
  const b2 = a2 + (b - a);
  if (b2 <= L) {
    strokeRange(ctx, tr, a2, b2);
  } else {
    strokeRange(ctx, tr, a2, L);
    strokeRange(ctx, tr, 0, b2 - L);
  }
};

export const drawPulses = (
  ctx: CanvasRenderingContext2D,
  board: Board,
  lut: Lut,
  scale: number,
  camX: number,
  camY: number,
  loopT: number,
) => {
  const w = ctx.canvas.width;
  const h = ctx.canvas.height;
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.clearRect(0, 0, w, h);
  ctx.setTransform(scale, 0, 0, scale, camX, camY);
  ctx.globalCompositeOperation = "lighter";
  ctx.lineCap = "round";
  ctx.lineJoin = "miter";
  ctx.miterLimit = 3;

  for (const p of board.pulses) {
    const tr = board.traces[p.trace];
    const L = tr.length;
    // Integer traversals per loop: at loopT = 1 every pulse is exactly back
    // where it started at loopT = 0.
    const head = ((p.phase + p.traversals * loopT) % 1) * L;
    const ramp = p.hot ? lut.hot : lut.pulse[tr.bucket];
    const baseWidth = TIER_WIDTHS[tr.tier] * p.widthScale;
    // A tail longer than the trace would overlap itself; keep it clear of that.
    const step = Math.min(p.tail, L * 0.55) / TAIL_STEPS;

    ctx.globalAlpha = p.intensity;
    for (let i = 0; i < TAIL_STEPS; i++) {
      const u = (i + 1) / TAIL_STEPS;
      const b = head - (TAIL_STEPS - 1 - i) * step;
      ctx.strokeStyle = ramp[i];
      ctx.lineWidth = baseWidth * (0.85 + 0.65 * u);
      strokeWrapped(ctx, tr, b - step, b);
    }

    // Hot cap right at the head.
    const seg = segmentAt(tr.cum, Math.min(head, L - 1e-3));
    const sp = Math.max(1e-6, tr.cum[seg + 1] - tr.cum[seg]);
    const t = Math.min(1, Math.max(0, (head - tr.cum[seg]) / sp));
    const hx = tr.xs[seg] + (tr.xs[seg + 1] - tr.xs[seg]) * t;
    const hy = tr.ys[seg] + (tr.ys[seg + 1] - tr.ys[seg]) * t;
    ctx.fillStyle = "rgb(255,255,255)";
    ctx.globalAlpha = p.intensity * 0.85;
    ctx.beginPath();
    ctx.arc(hx, hy, baseWidth * 0.6, 0, Math.PI * 2);
    ctx.fill();

    // Vias and pads flash as the head passes over them, then fade behind it.
    for (const n of tr.nodes) {
      let d = head - n.s;
      if (d < -L / 2) d += L;
      if (d > L / 2) d -= L;
      if (d < -40 || d > 300) continue;
      const k = d < 0 ? (d + 40) / 40 : Math.pow(1 - d / 300, 1.9);
      ctx.globalAlpha = Math.min(1, k * p.intensity * 0.85);
      ctx.fillStyle = k > 0.75 ? "rgb(255,255,255)" : lut.lit[tr.bucket];
      ctx.beginPath();
      ctx.arc(n.x, n.y, n.r * (0.7 + 0.4 * k), 0, Math.PI * 2);
      ctx.fill();
    }
  }

  ctx.globalAlpha = 1;
  ctx.globalCompositeOperation = "source-over";
  ctx.setTransform(1, 0, 0, 1, 0, 0);
};

// ---------------------------------------------------------------------------
// Grain
// ---------------------------------------------------------------------------

const GRAIN_TILES = 8;
const GRAIN_SIZE = 256;
let grainCache: HTMLCanvasElement[] | null = null;

/**
 * Fixed set of noise tiles, generated once from a seeded PRNG. Cycling through
 * them by frame index keeps the grain deterministic (Remotion renders frames
 * out of order) while still moving. GRAIN_TILES divides 480, so the cycle loops.
 */
export const grainTiles = (): HTMLCanvasElement[] => {
  if (grainCache) return grainCache;
  const rnd = mulberry32(0x9e3779b9);
  grainCache = [];
  for (let t = 0; t < GRAIN_TILES; t++) {
    const c = document.createElement("canvas");
    c.width = GRAIN_SIZE;
    c.height = GRAIN_SIZE;
    const g = c.getContext("2d") as CanvasRenderingContext2D;
    const img = g.createImageData(GRAIN_SIZE, GRAIN_SIZE);
    const d = img.data;
    for (let i = 0; i < d.length; i += 4) {
      const v = Math.round(rnd() * 205);
      d[i] = v;
      d[i + 1] = v;
      d[i + 2] = v;
      d[i + 3] = 255;
    }
    g.putImageData(img, 0, 0);
    grainCache.push(c);
  }
  return grainCache;
};

export const drawVignette = (
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  strength: number,
) => {
  const g = ctx.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, Math.hypot(w, h) * 0.58);
  g.addColorStop(0, "rgba(0,0,0,0)");
  g.addColorStop(0.55, "rgba(0,0,0,0)");
  g.addColorStop(1, `rgba(0,0,0,${strength})`);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);
};

