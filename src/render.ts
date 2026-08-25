import {
  BOARD_MATRIX,
  BODY_W,
  CHART_B,
  CHART_L,
  CHART_R,
  CHART_T,
  CELL_R,
  COL,
  FRAMES_PER_CANDLE,
  HEIGHT,
  LIVE_X,
  N_CANDLES,
  PITCH,
  PRICE_B,
  PRICE_T,
  PRICE_ZOOM,
  PRICE_FOLLOW,
  SERIES_W,
  STROKE_W,
  WICK_W,
  WIDTH,
  DURATION,
} from "./config";
import {
  blurAt,
  buildBokeh,
  buildChrome,
  buildLadder,
  depthWeights,
  type Blob,
  type Cell,
  type Readout,
} from "./layout";
import {
  breathe,
  buildFlashes,
  flashIntensity,
  formingClose,
  leadCandle,
} from "./motion";
import { buildSeries, type Series } from "./series";

// ── Colour helpers ─────────────────────────────────────────────────────────

const hexCache = new Map<string, [number, number, number]>();
const toRgb = (hex: string): [number, number, number] => {
  const hit = hexCache.get(hex);
  if (hit) return hit;
  const n = parseInt(hex.slice(1), 16);
  const v: [number, number, number] = [
    (n >> 16) & 255,
    (n >> 8) & 255,
    n & 255,
  ];
  hexCache.set(hex, v);
  return v;
};

/**
 * `hex` scaled by `k` (the breathe, depth and flash multipliers) at alpha `a`.
 *
 * Clamping each channel on its own would shift the hue — a boosted green goes
 * cyan as soon as blue and green both peg. Instead the excess is held as hue
 * and rolled into a white-hot core, which is what an overexposed highlight
 * actually looks like.
 */
const tint = (hex: string, k: number, a = 1) => {
  const [r0, g0, b0] = toRgb(hex);
  let r = r0 * k;
  let g = g0 * k;
  let b = b0 * k;
  const m = Math.max(r, g, b);
  if (m > 255) {
    const s = 255 / m;
    const w = Math.min(0.8, (m / 255 - 1) * 0.55);
    r = r * s * (1 - w) + 255 * w;
    g = g * s * (1 - w) + 255 * w;
    b = b * s * (1 - w) + 255 * w;
  }
  return `rgba(${Math.round(r)},${Math.round(g)},${Math.round(b)},${a})`;
};

// ── Depth buffers ──────────────────────────────────────────────────────────

type Layer = {
  canvas: HTMLCanvasElement;
  ctx: CanvasRenderingContext2D;
  /** Backing-store scale. The blurred layers render small and upscale. */
  scale: number;
  /** Blur radius, in final-frame px, applied once when the layer composites. */
  blur: number;
  /**
   * Scratch canvas at the layer's own resolution. Blurring here — at a
   * proportionally smaller radius — and only then upscaling costs a fraction
   * of blurring a 4K draw, and the upscale hides the difference.
   */
  blurCanvas: HTMLCanvasElement | null;
  blurCtx: CanvasRenderingContext2D | null;
};

export type Model = {
  layers: [Layer, Layer, Layer];
  bloom: {
    canvas: HTMLCanvasElement;
    ctx: CanvasRenderingContext2D;
    blurCanvas: HTMLCanvasElement;
    blurCtx: CanvasRenderingContext2D;
  };
  grain: HTMLCanvasElement[];
  series: Series;
  ladder: Cell[];
  bokeh: Blob[];
  chrome: Readout[];
  flashes: ReturnType<typeof buildFlashes>;
};

const makeCanvas = (scale: number) => {
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(WIDTH * scale);
  canvas.height = Math.round(HEIGHT * scale);
  return canvas;
};

const makeLayer = (scale: number, blur: number): Layer => {
  const canvas = makeCanvas(scale);
  const ctx = canvas.getContext("2d", {
    alpha: true,
  }) as CanvasRenderingContext2D;
  const blurCanvas = scale < 1 ? makeCanvas(scale) : null;
  return {
    canvas,
    ctx,
    scale,
    blur,
    blurCanvas,
    blurCtx: blurCanvas
      ? (blurCanvas.getContext("2d") as CanvasRenderingContext2D)
      : null,
  };
};

const GRAIN_TILES = 8; // DURATION % 8 === 0, so the grain cycle closes.
const GRAIN_SIZE = 640;

/** Deterministic PRNG for the grain tiles — seeded, never Math.random. */
const mulberry32 = (seed: number) => () => {
  seed |= 0;
  seed = (seed + 0x6d2b79f5) | 0;
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};

const makeGrain = (): HTMLCanvasElement[] => {
  const tiles: HTMLCanvasElement[] = [];
  for (let t = 0; t < GRAIN_TILES; t++) {
    const c = document.createElement("canvas");
    c.width = GRAIN_SIZE;
    c.height = GRAIN_SIZE;
    const cx = c.getContext("2d") as CanvasRenderingContext2D;
    const img = cx.createImageData(GRAIN_SIZE, GRAIN_SIZE);
    const rnd = mulberry32(0x9e3779b9 + t * 7919);
    const d = img.data;
    for (let i = 0; i < d.length; i += 4) {
      const u = rnd();
      const v = Math.round(u * u * u * 255);
      d[i] = v;
      d[i + 1] = v;
      d[i + 2] = v;
      d[i + 3] = 255;
    }
    cx.putImageData(img, 0, 0);
    tiles.push(c);
  }
  return tiles;
};

export const buildModel = (): Model => ({
  layers: [makeLayer(1, 1.2), makeLayer(0.5, 8), makeLayer(0.34, 24)],
  bloom: (() => {
    const canvas = makeCanvas(BLOOM_SCALE);
    const blurCanvas = makeCanvas(BLOOM_SCALE);
    return {
      canvas,
      ctx: canvas.getContext("2d") as CanvasRenderingContext2D,
      blurCanvas,
      blurCtx: blurCanvas.getContext("2d") as CanvasRenderingContext2D,
    };
  })(),
  grain: makeGrain(),
  series: buildSeries(),
  ladder: buildLadder(),
  bokeh: buildBokeh(),
  chrome: buildChrome(),
  flashes: buildFlashes(),
});

// ── Painting ───────────────────────────────────────────────────────────────

const applyBoard = (l: Layer) => {
  const [a, b, c, d, e, f] = BOARD_MATRIX;
  const s = l.scale;
  l.ctx.setTransform(a * s, b * s, c * s, d * s, e * s, f * s);
};

export const paint = (
  ctx: CanvasRenderingContext2D,
  frame: number,
  m: Model,
) => {
  const f = ((frame % DURATION) + DURATION) % DURATION;
  const lum = breathe(f);
  const { layers } = m;

  for (const l of layers) {
    l.ctx.setTransform(1, 0, 0, 1, 0, 0);
    l.ctx.clearRect(0, 0, l.canvas.width, l.canvas.height);
  }

  // Chart content is clipped to the panel so the series never spills into the
  // ladder region; the panel's right edge is a real, if very soft, boundary.
  for (const l of layers) {
    l.ctx.save();
    applyBoard(l);
    l.ctx.beginPath();
    l.ctx.rect(CHART_L, CHART_T, CHART_R - CHART_L, CHART_B - CHART_T);
    l.ctx.clip();
    l.ctx.lineCap = "butt";
    l.ctx.lineJoin = "miter";
  }
  drawGrid(layers, lum);
  drawCandles(layers, m.series, f, lum);
  for (const l of layers) l.ctx.restore();

  for (const l of layers) {
    l.ctx.save();
    applyBoard(l);
  }
  drawBokeh(layers, m.bokeh, lum);
  drawLadder(layers, m.ladder, m.flashes, f, lum);
  drawChrome(layers, m.chrome, lum);
  for (const l of layers) l.ctx.restore();

  // ── Composite ───────────────────────────────────────────────────────────
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.globalCompositeOperation = "source-over";
  ctx.globalAlpha = 1;
  ctx.filter = "none";
  ctx.fillStyle = COL.substrate;
  ctx.fillRect(0, 0, WIDTH, HEIGHT);
  drawPanelWash(ctx, lum);

  for (let i = layers.length - 1; i >= 0; i--) {
    const l = layers[i];
    if (l.blurCtx && l.blurCanvas) {
      l.blurCtx.setTransform(1, 0, 0, 1, 0, 0);
      l.blurCtx.clearRect(0, 0, l.blurCanvas.width, l.blurCanvas.height);
      l.blurCtx.filter = `blur(${l.blur * l.scale}px)`;
      l.blurCtx.drawImage(l.canvas, 0, 0);
      l.blurCtx.filter = "none";
      ctx.drawImage(l.blurCanvas, 0, 0, WIDTH, HEIGHT);
    } else {
      ctx.filter = `blur(${l.blur}px)`;
      ctx.drawImage(l.canvas, 0, 0, WIDTH, HEIGHT);
      ctx.filter = "none";
    }
  }
  ctx.filter = "none";

  drawBloom(ctx, m);
  drawVignette(ctx);
  drawGrain(ctx, m, f);
};

// ── Chart furniture ────────────────────────────────────────────────────────

/** A barely-there wash marking the chart panel, with a soft right edge. */
const drawPanelWash = (ctx: CanvasRenderingContext2D, lum: number) => {
  ctx.save();
  const [a, b, c, d, e, f] = BOARD_MATRIX;
  ctx.setTransform(a, b, c, d, e, f);
  const g = ctx.createLinearGradient(CHART_L, 0, CHART_R, 0);
  g.addColorStop(0, tint("#06101C", lum, 1));
  g.addColorStop(0.74, tint("#06101C", lum, 0.85));
  g.addColorStop(1, tint("#06101C", lum, 0));
  ctx.fillStyle = g;
  ctx.fillRect(CHART_L, CHART_T, CHART_R - CHART_L, CHART_B - CHART_T);
  ctx.restore();
};

/**
 * Grid rules and the single dashed price marker. Long horizontals are drawn
 * in segments so each one picks up the depth of the region it crosses,
 * instead of the whole line snapping into one focus bucket.
 */
const drawGrid = (layers: Layer[], lum: number) => {
  const SEGS = 12;
  const segW = (CHART_R - CHART_L) / SEGS;

  const line = (y: number, color: string, width: number, dash: number[]) => {
    for (let s = 0; s < SEGS; s++) {
      const x0 = CHART_L + s * segW;
      const w = depthWeights(blurAt(x0 + segW / 2, y));
      for (let li = 0; li < 3; li++) {
        if (w[li] < 0.012) continue;
        const c = layers[li].ctx;
        c.setLineDash(dash);
        c.lineDashOffset = -(s * segW);
        c.strokeStyle = tint(color, lum, w[li]);
        c.lineWidth = width;
        c.beginPath();
        c.moveTo(x0, y);
        c.lineTo(x0 + segW + 1, y);
        c.stroke();
        c.setLineDash([]);
      }
    }
  };

  for (let i = 0; i <= 8; i++) {
    line(
      PRICE_T - 80 + ((PRICE_B + 260 - (PRICE_T - 80)) * i) / 8,
      COL.grid,
      2.5,
      [],
    );
  }
  line(PRICE_B - (PRICE_B - PRICE_T) * 0.28, COL.dashed, 4, [30, 26]);
  line(PRICE_B - (PRICE_B - PRICE_T) * 0.06, COL.dashed, 4, [30, 26]);
};

// ── Candles ────────────────────────────────────────────────────────────────

/** Widening, fading passes that stand in for the phosphor halo. */
const CANDLE_GLOW: ReadonlyArray<readonly [number, number]> = [
  [8, 0.05],
  [3.2, 0.16],
];

const drawCandles = (
  layers: Layer[],
  series: Series,
  frame: number,
  lum: number,
) => {
  const { candles, windowMean, min, max } = series;
  const midPrice = (min + max) / 2;
  const midY = (PRICE_T + PRICE_B) / 2;
  const pxPerPrice = ((PRICE_B - PRICE_T) / (max - min)) * PRICE_ZOOM;

  const g = frame / FRAMES_PER_CANDLE;
  // Continuous interpolation between adjacent window means, so the axis
  // slides rather than stepping once per candle.
  const gi = Math.floor(g);
  const gf = g - gi;
  const wm =
    windowMean[gi % N_CANDLES] * (1 - gf) +
    windowMean[(gi + 1) % N_CANDLES] * gf;
  const pivot = midPrice + (wm - midPrice) * PRICE_FOLLOW;
  const yOf = (p: number) => midY - (p - pivot) * pxPerPrice;
  const lead = leadCandle(frame);
  const half = BODY_W / 2;

  for (let copy = 0; copy >= -1; copy--) {
    for (let i = 0; i < N_CANDLES; i++) {
      const cx = LIVE_X - (g - i) * PITCH + copy * SERIES_W;
      // Nothing exists to the right of the forming candle — that is the live
      // edge of the chart.
      if (cx < CHART_L - PITCH || cx > LIVE_X + PITCH * 0.5) continue;

      const c = candles[i];
      let { open, close, high, low } = c;

      // The newest candle is still forming: its close drifts, so the body
      // grows, shrinks and can flip colour until the scroll locks it in.
      if (i === lead.index) {
        close = formingClose(c.open, c.close, lead.phase, i);
        const hi = Math.max(open, close);
        const lo = Math.min(open, close);
        high = hi + (c.high - Math.max(c.open, c.close)) * lead.phase;
        low = lo - (Math.min(c.open, c.close) - c.low) * lead.phase;
      }

      const up = close > open;
      const color = up ? COL.green : COL.red;
      const yTop = yOf(Math.max(open, close));
      const yBot = yOf(Math.min(open, close));
      const bodyH = Math.max(STROKE_W, yBot - yTop);
      const w = depthWeights(blurAt(cx, (yTop + yBot) / 2));

      for (let li = 0; li < 3; li++) {
        const a = w[li];
        if (a < 0.012) continue;
        const cc = layers[li].ctx;
        // Defocused candles are boosted before they blur, so they bloom into
        // the black rather than smearing into mush.
        const k = lum * (li === 0 ? 1 : li === 1 ? 1.25 : 1.5);

        // A wide, faint additive pass under the candle. Phosphor on a screen
        // this close does not have hard edges, and without it the candles read
        // flat next to the blown-out ladder.
        cc.globalCompositeOperation = "lighter";
        for (const [mult, fade] of CANDLE_GLOW) {
          cc.strokeStyle = tint(color, k, a * fade);
          cc.lineWidth = STROKE_W * mult;
          cc.beginPath();
          cc.moveTo(cx, yOf(high));
          cc.lineTo(cx, yOf(low));
          cc.stroke();
          cc.strokeRect(cx - half, yTop, BODY_W, bodyH);
        }
        cc.globalCompositeOperation = "source-over";

        cc.strokeStyle = tint(color, k, a);
        cc.lineWidth = WICK_W;
        cc.beginPath();
        cc.moveTo(cx, yOf(high));
        cc.lineTo(cx, yOf(low));
        cc.stroke();

        if (c.filled) {
          cc.fillStyle = tint(color, k, a);
          cc.fillRect(cx - half, yTop, BODY_W, bodyH);
        } else {
          // Hollow: knock the interior back to the substrate so the wick
          // doesn't read through the body, then outline it.
          cc.fillStyle = tint(COL.substrate, lum, a * 0.92);
          cc.fillRect(cx - half, yTop, BODY_W, bodyH);
          cc.lineWidth = STROKE_W;
          cc.strokeRect(
            cx - half + STROKE_W / 2,
            yTop + STROKE_W / 2,
            BODY_W - STROKE_W,
            Math.max(STROKE_W, bodyH - STROKE_W),
          );
        }
      }
    }
  }
};

// ── Ladder, bokeh, chrome ──────────────────────────────────────────────────

/** A soft radial disc, used to make bright things bloom before they blur. */
const glow = (
  c: CanvasRenderingContext2D,
  x: number,
  y: number,
  r: number,
  color: string,
  k: number,
  a: number,
) => {
  const g = c.createRadialGradient(x, y, 0, x, y, r);
  g.addColorStop(0, tint(color, k, a));
  g.addColorStop(0.5, tint(color, k, a * 0.42));
  g.addColorStop(1, tint(color, k, 0));
  c.fillStyle = g;
  c.beginPath();
  c.arc(x, y, r, 0, Math.PI * 2);
  c.fill();
};

/**
 * Resting brightness of a ladder cell. A flash pushes past white: the core
 * clips and the halo swells, which is how a defocused highlight blooms.
 */
const REST = 1.02;

const drawLadder = (
  layers: Layer[],
  cells: Cell[],
  flashes: ReturnType<typeof buildFlashes>,
  frame: number,
  lum: number,
) => {
  for (let i = 0; i < cells.length; i++) {
    const cell = cells[i];
    const fi = flashIntensity(flashes, i, frame);
    // Cells idle below full white so a flash has somewhere to go: ~200% of
    // the resting brightness, then eased back down.
    const k = lum * REST * (1 + fi * 1.2);
    const w = depthWeights(blurAt(cell.x, cell.y));
    const x = cell.x - cell.w / 2;
    const y = cell.y - cell.h / 2;

    for (let li = 0; li < 3; li++) {
      const a = w[li] * cell.alpha;
      if (a < 0.012) continue;
      const c = layers[li].ctx;
      // The blurred layers lose a lot of peak brightness to the blur itself,
      // so they are boosted hard before it is applied.
      const boost = li === 0 ? 1 : li === 1 ? 1.5 : 2.2;
      c.globalCompositeOperation = "lighter";
      glow(
        c,
        cell.x,
        cell.y,
        cell.w * (0.55 + fi * 0.5),
        cell.color,
        k * boost,
        a * (0.38 + fi * 0.6),
      );
      c.globalCompositeOperation = "source-over";
      c.fillStyle = tint(cell.color, k * boost, a);
      c.beginPath();
      c.roundRect(x, y, cell.w, cell.h, CELL_R);
      c.fill();
    }
  }
};

const drawBokeh = (layers: Layer[], blobs: Blob[], lum: number) => {
  for (const b of blobs) {
    const w = depthWeights(blurAt(b.x, b.y));
    for (let li = 0; li < 3; li++) {
      const a = w[li] * b.alpha;
      if (a < 0.012) continue;
      const c = layers[li].ctx;
      const boost = li === 2 ? 1.6 : 1.2;
      c.globalCompositeOperation = "lighter";
      glow(
        c,
        b.x,
        b.y,
        Math.max(b.w, b.h) * 0.8,
        b.color,
        lum * boost,
        a * 0.42,
      );
      c.globalCompositeOperation = "source-over";
      if (!b.glowOnly) {
        c.fillStyle = tint(b.color, lum * boost, a * 0.7);
        c.fillRect(b.x - b.w / 2, b.y - b.h / 2, b.w, b.h);
      }
    }
  }
};

/** Terminal chrome along the top edge: cropped, blurred, never legible. */
const drawChrome = (layers: Layer[], readouts: Readout[], lum: number) => {
  layers[2].ctx.fillStyle = tint("#0D1620", lum, 0.85);
  layers[2].ctx.fillRect(CHART_L, -180, 4600, 168);
  // Drawn into the mid layer, not the far one: soft enough to stay unreadable
  // at a glance but still shaped like numbers.
  const c = layers[1].ctx;
  c.textBaseline = "middle";
  for (const r of readouts) {
    c.font = `${r.size}px "DejaVu Sans Mono", "Liberation Mono", monospace`;
    c.fillStyle = tint(COL.chrome, lum * 1.35, 0.95);
    c.fillText(r.text, r.x, r.y);
  }
};

// ── Finish ─────────────────────────────────────────────────────────────────

const BLOOM_SCALE = 0.25;
const BLOOM_BLUR = 40;

/** Squaring the downscaled frame keeps the darks out of the bloom. */
const drawBloom = (ctx: CanvasRenderingContext2D, m: Model) => {
  const { canvas: bc, ctx: bx, blurCanvas: gc, blurCtx: gx } = m.bloom;
  bx.setTransform(1, 0, 0, 1, 0, 0);
  bx.globalCompositeOperation = "source-over";
  bx.globalAlpha = 1;
  bx.clearRect(0, 0, bc.width, bc.height);
  bx.drawImage(ctx.canvas, 0, 0, bc.width, bc.height);
  bx.globalCompositeOperation = "multiply";
  bx.drawImage(bc, 0, 0);
  bx.globalCompositeOperation = "source-over";

  gx.setTransform(1, 0, 0, 1, 0, 0);
  gx.clearRect(0, 0, gc.width, gc.height);
  gx.filter = `blur(${BLOOM_BLUR * BLOOM_SCALE}px)`;
  gx.drawImage(bc, 0, 0);
  gx.filter = "none";

  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  ctx.globalAlpha = 0.5;
  ctx.drawImage(gc, 0, 0, WIDTH, HEIGHT);
  ctx.restore();
};

const drawVignette = (ctx: CanvasRenderingContext2D) => {
  ctx.save();
  ctx.setTransform(1, 0, 0, HEIGHT / WIDTH, 0, 0);
  const r = WIDTH * 0.76;
  const g = ctx.createRadialGradient(
    WIDTH / 2,
    WIDTH / 2,
    r * 0.28,
    WIDTH / 2,
    WIDTH / 2,
    r,
  );
  g.addColorStop(0, "rgba(0,0,0,0)");
  g.addColorStop(0.55, "rgba(0,0,0,0.04)");
  g.addColorStop(1, "rgba(0,0,0,0.3)");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, WIDTH, WIDTH);
  ctx.restore();
};

const drawGrain = (ctx: CanvasRenderingContext2D, m: Model, frame: number) => {
  const tile = m.grain[frame % GRAIN_TILES];
  // Offset is a function of frame % DURATION, so it wraps with the loop.
  const ox = -((frame * 137) % GRAIN_SIZE);
  const oy = -((frame * 71) % GRAIN_SIZE);
  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  ctx.globalAlpha = 0.04;
  for (let x = ox; x < WIDTH; x += GRAIN_SIZE) {
    for (let y = oy; y < HEIGHT; y += GRAIN_SIZE) {
      ctx.drawImage(tile, x, y);
    }
  }
  ctx.restore();
};
