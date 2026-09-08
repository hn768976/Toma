/**
 * Draws the entire composite flat, at full resolution, into a 2D canvas. The
 * cylindrical warp is applied afterwards as a post-process, which keeps the
 * charts as paths and the labels as real text while still producing an exact,
 * uniform curve.
 *
 * Everything here is a pure function of the frame number. No state is carried
 * between frames.
 */
import { hexA, hexToRgb, rgba } from "./color";
import {
  FLAT_HEIGHT,
  FLAT_WIDTH,
  type Palette,
} from "./constants";
import { DOTS, HOT_SPOTS } from "./dots";
import { getGlowSprite, stampGlow } from "./glow-sprite";
import { ARCS, BARS, CHARTS, TEXTURE_BLOCKS } from "./scene";

const TAU = Math.PI * 2;
const LABEL_FONT = `"Helvetica Neue", Arial, "DejaVu Sans", sans-serif`;

const clamp01 = (v: number): number => (v < 0 ? 0 : v > 1 ? 1 : v);

/** Linear ramp with both ends clamped — the same shape as Remotion's interpolate. */
const ramp = (v: number, a: number, b: number): number =>
  a === b ? (v < a ? 0 : 1) : clamp01((v - a) / (b - a));

/* ----------------------------------------------------- dot batching buffers */

const BRIGHTNESS_BUCKETS = 22;
const BUCKET_TOTAL = BRIGHTNESS_BUCKETS * 2;
const bucketOfDot = new Uint8Array(DOTS.count);
const bucketCounts = new Int32Array(BUCKET_TOTAL);
const bucketOffsets = new Int32Array(BUCKET_TOTAL + 1);
const bucketCursor = new Int32Array(BUCKET_TOTAL);
const dotOrder = new Int32Array(DOTS.count);

/* -------------------------------------------------------------- background */

const drawField = (
  ctx: CanvasRenderingContext2D,
  palette: Palette,
  frame: number,
): void => {
  ctx.fillStyle = palette.bgOuter;
  ctx.fillRect(0, 0, FLAT_WIDTH, FLAT_HEIGHT);

  const cx = FLAT_WIDTH * 0.5;
  const cy = FLAT_HEIGHT * 0.48;
  const gradient = ctx.createRadialGradient(
    cx,
    cy,
    FLAT_WIDTH * 0.04,
    cx,
    cy,
    FLAT_WIDTH * 0.72,
  );
  gradient.addColorStop(0, palette.bgInner);
  gradient.addColorStop(0.55, hexA(palette.bgInner, 0.55));
  gradient.addColorStop(1, hexA(palette.bgOuter, 0));
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, FLAT_WIDTH, FLAT_HEIGHT);

  // Faint glow behind the densest regions of the dot matrix.
  ctx.globalCompositeOperation = "lighter";
  const glow = getGlowSprite(palette.regionGlow, 0.5);
  for (let i = 0; i < HOT_SPOTS.length; i++) {
    const spot = HOT_SPOTS[i];
    const breathe = 0.86 + 0.14 * Math.sin(frame * 0.011 + i * 1.7);
    ctx.globalAlpha = spot.strength * breathe;
    stampGlow(ctx, glow, spot.x, spot.y, spot.radius * breathe);
  }
  ctx.globalAlpha = 1;
  ctx.globalCompositeOperation = "source-over";
};

const drawGrid = (ctx: CanvasRenderingContext2D, palette: Palette): void => {
  const minorX = FLAT_WIDTH / 64;
  const minorY = FLAT_HEIGHT / 30;

  // Drawn past the canvas bounds so the drift can never expose an edge.
  const bleed = 3;
  ctx.lineWidth = 1.6;
  for (let i = -bleed; i * minorX <= FLAT_WIDTH + bleed * minorX; i++) {
    const major = ((i % 8) + 8) % 8 === 0;
    ctx.strokeStyle = hexA(palette.grid, palette.gridAlpha * (major ? 1.7 : 0.62));
    ctx.beginPath();
    ctx.moveTo(i * minorX, -bleed * minorY);
    ctx.lineTo(i * minorX, FLAT_HEIGHT + bleed * minorY);
    ctx.stroke();
  }
  for (let i = -bleed; i * minorY <= FLAT_HEIGHT + bleed * minorY; i++) {
    const major = ((i % 5) + 5) % 5 === 0;
    ctx.strokeStyle = hexA(palette.grid, palette.gridAlpha * (major ? 1.7 : 0.62));
    ctx.beginPath();
    ctx.moveTo(-bleed * minorX, i * minorY);
    ctx.lineTo(FLAT_WIDTH + bleed * minorX, i * minorY);
    ctx.stroke();
  }
};

/* --------------------------------------------------------------- dot matrix */

const drawDots = (
  ctx: CanvasRenderingContext2D,
  palette: Palette,
  frame: number,
): void => {
  const { brightness, shimmerAmp, shimmerPhase, shimmerSpeed, accent, count } =
    DOTS;

  bucketCounts.fill(0);
  for (let i = 0; i < count; i++) {
    let b = brightness[i];
    const amp = shimmerAmp[i];
    if (amp !== 0) {
      b *= 1 + amp * Math.sin(frame * shimmerSpeed[i] + shimmerPhase[i]);
    }
    let level = Math.round(clamp01(b) * (BRIGHTNESS_BUCKETS - 1));
    if (level < 0) level = 0;
    const bucket = (accent[i] === 1 ? BRIGHTNESS_BUCKETS : 0) + level;
    bucketOfDot[i] = bucket;
    bucketCounts[bucket]++;
  }

  bucketOffsets[0] = 0;
  for (let b = 0; b < BUCKET_TOTAL; b++) {
    bucketOffsets[b + 1] = bucketOffsets[b] + bucketCounts[b];
    bucketCursor[b] = bucketOffsets[b];
  }
  for (let i = 0; i < count; i++) {
    dotOrder[bucketCursor[bucketOfDot[i]]++] = i;
  }

  const baseRgb = hexToRgb(palette.dot);
  const accentRgb = hexToRgb(palette.dotAccent);
  const { x, y, radius } = DOTS;

  for (let b = 0; b < BUCKET_TOTAL; b++) {
    const from = bucketOffsets[b];
    const to = bucketOffsets[b + 1];
    if (from === to) continue;
    const isAccent = b >= BRIGHTNESS_BUCKETS;
    const level = b - (isAccent ? BRIGHTNESS_BUCKETS : 0);
    const alpha = (level / (BRIGHTNESS_BUCKETS - 1)) * (isAccent ? 1 : 0.92);
    if (alpha <= 0.012) continue;
    ctx.fillStyle = rgba(isAccent ? accentRgb : baseRgb, alpha);
    for (let k = from; k < to; k++) {
      const i = dotOrder[k];
      const size = radius[i] * 2;
      ctx.fillRect(x[i] - radius[i], y[i] - radius[i], size, size);
    }
  }

  // A soft halo on the brightest accents only — the bloom the brief asks for,
  // kept off the grid so the frame does not fog.
  ctx.globalCompositeOperation = "lighter";
  const sprite = getGlowSprite(palette.dotAccent, 0.34);
  for (let b = BRIGHTNESS_BUCKETS + Math.floor(BRIGHTNESS_BUCKETS * 0.62); b < BUCKET_TOTAL; b++) {
    const from = bucketOffsets[b];
    const to = bucketOffsets[b + 1];
    if (from === to) continue;
    const level = b - BRIGHTNESS_BUCKETS;
    ctx.globalAlpha = 0.16 + 0.4 * (level / (BRIGHTNESS_BUCKETS - 1));
    for (let k = from; k < to; k++) {
      const i = dotOrder[k];
      stampGlow(ctx, sprite, x[i], y[i], 11 + radius[i] * 5);
    }
  }
  ctx.globalAlpha = 1;
  ctx.globalCompositeOperation = "source-over";
};

/* ------------------------------------------------------------------ charts */

const drawCharts = (
  ctx: CanvasRenderingContext2D,
  palette: Palette,
  frame: number,
): void => {
  for (const chart of CHARTS) {
    // Steady, unaeased progression: this is data being plotted.
    const progress = ramp(frame, chart.start, chart.end);
    if (progress <= 0) continue;

    const exact = progress * (chart.count - 1);
    const whole = Math.floor(exact);
    const partial = exact - whole;

    ctx.beginPath();
    ctx.moveTo(chart.points[0], chart.points[1]);
    for (let i = 1; i <= whole; i++) {
      ctx.lineTo(chart.points[i * 2], chart.points[i * 2 + 1]);
    }
    if (whole < chart.count - 1 && partial > 0) {
      const ax = chart.points[whole * 2];
      const ay = chart.points[whole * 2 + 1];
      const bx = chart.points[(whole + 1) * 2];
      const by = chart.points[(whole + 1) * 2 + 1];
      ctx.lineTo(ax + (bx - ax) * partial, ay + (by - ay) * partial);
    }

    ctx.lineJoin = "miter";
    ctx.lineCap = "round";
    ctx.strokeStyle = hexA(palette.chartGlow, 0.5);
    ctx.lineWidth = chart.lineWidth * 3.1;
    ctx.shadowColor = hexA(palette.chartGlow, 0.85);
    ctx.shadowBlur = 34;
    ctx.stroke();
    ctx.shadowBlur = 0;

    ctx.strokeStyle = palette.chart;
    ctx.lineWidth = chart.lineWidth;
    ctx.stroke();

    // Vertex nodes.
    ctx.fillStyle = palette.chart;
    for (const index of chart.nodes) {
      if (index > exact) break;
      const nx = chart.points[index * 2];
      const ny = chart.points[index * 2 + 1];
      ctx.beginPath();
      ctx.arc(nx, ny, chart.lineWidth * 1.35, 0, TAU);
      ctx.fill();
    }

    // Labels appear as the line passes them.
    ctx.font = `500 20px ${LABEL_FONT}`;
    ctx.textAlign = "left";
    ctx.textBaseline = "middle";
    for (const label of chart.labels) {
      const passFrame =
        chart.start + ((chart.end - chart.start) * label.index) / (chart.count - 1);
      const appear = ramp(frame, passFrame, passFrame + 7);
      if (appear <= 0) continue;
      const lx = chart.points[label.index * 2];
      const ly = chart.points[label.index * 2 + 1];
      ctx.font = `500 ${label.size.toFixed(1)}px ${LABEL_FONT}`;
      ctx.fillStyle = hexA(palette.label, label.alpha * appear);
      ctx.fillText(label.text, lx + 9, ly + label.dy);
      ctx.strokeStyle = hexA(palette.label, label.alpha * appear * 0.5);
      ctx.lineWidth = 1.4;
      ctx.beginPath();
      ctx.moveTo(lx, ly);
      ctx.lineTo(lx, ly + label.dy * 0.72);
      ctx.stroke();
    }
  }
};

/* -------------------------------------------------------------------- arcs */

const quadAt = (
  a: number,
  c: number,
  b: number,
  t: number,
): number => {
  const mt = 1 - t;
  return mt * mt * a + 2 * mt * t * c + t * t * b;
};

const ARC_STEPS = 96;

const drawArcs = (
  ctx: CanvasRenderingContext2D,
  palette: Palette,
  frame: number,
): void => {
  const nodeGlow = getGlowSprite(palette.arcNode, 0.5);

  for (let i = 0; i < ARCS.length; i++) {
    const arc = ARCS[i];
    const progress = ramp(frame, arc.start, arc.end);
    if (progress <= 0) continue;

    ctx.beginPath();
    ctx.moveTo(arc.ax, arc.ay);
    const steps = Math.max(1, Math.ceil(ARC_STEPS * progress));
    for (let s = 1; s <= steps; s++) {
      const t = (progress * s) / steps;
      ctx.lineTo(
        quadAt(arc.ax, arc.cx, arc.bx, t),
        quadAt(arc.ay, arc.cy, arc.by, t),
      );
    }
    ctx.strokeStyle = hexA(palette.arc, 0.78);
    ctx.lineWidth = arc.width;
    ctx.lineCap = "round";
    ctx.shadowColor = hexA(palette.arc, 0.8);
    ctx.shadowBlur = 16;
    ctx.stroke();
    ctx.shadowBlur = 0;

    ctx.globalCompositeOperation = "lighter";

    // Origin node, and the destination node once the arc lands.
    stampGlow(ctx, nodeGlow, arc.ax, arc.ay, 34);
    ctx.fillStyle = palette.arcNode;
    ctx.beginPath();
    ctx.arc(arc.ax, arc.ay, 4.6, 0, TAU);
    ctx.fill();

    if (progress >= 1) {
      stampGlow(ctx, nodeGlow, arc.bx, arc.by, 34);
      ctx.beginPath();
      ctx.arc(arc.bx, arc.by, 4.6, 0, TAU);
      ctx.fill();
    }

    // A dot travelling the arc: it leads the draw-on, then loops on the hold.
    if (i % 7 !== 3) {
      const t =
        progress < 1
          ? progress
          : ((frame - arc.end) / arc.travelPeriod + arc.travelPhase) % 1;
      const tx = quadAt(arc.ax, arc.cx, arc.bx, t);
      const ty = quadAt(arc.ay, arc.cy, arc.by, t);
      stampGlow(ctx, nodeGlow, tx, ty, 26);
      ctx.fillStyle = palette.arcNode;
      ctx.beginPath();
      ctx.arc(tx, ty, 3.6, 0, TAU);
      ctx.fill();
    }

    ctx.globalCompositeOperation = "source-over";
  }
};

/* -------------------------------------------------------------------- bars */

const segmentsAt = (
  steps: readonly (readonly [number, number])[],
  frame: number,
): number => {
  let current = steps[0][1];
  for (let i = 1; i < steps.length; i++) {
    const [at, value] = steps[i];
    if (frame < at) break;
    const previous = steps[i - 1][1];
    current = previous + (value - previous) * ramp(frame, at, at + 14);
  }
  return current;
};

const drawBars = (
  ctx: CanvasRenderingContext2D,
  palette: Palette,
  frame: number,
): void => {
  for (const column of BARS) {
    const rise = ramp(frame, column.start, column.end);
    if (rise <= 0) continue;
    const target = segmentsAt(column.steps, frame) * rise;
    const whole = Math.floor(target);
    const partial = target - whole;
    const pitch = column.segmentHeight + column.gap;

    for (let s = 0; s <= whole; s++) {
      const height = s === whole ? column.segmentHeight * partial : column.segmentHeight;
      if (height < 0.4) continue;
      const y = column.baseY - s * pitch - height;
      const highlighted = column.highlights[s % column.highlights.length] === 1;
      ctx.fillStyle = highlighted
        ? hexA(palette.barHighlight, 0.72)
        : hexA(palette.bar, 0.34 + 0.42 * (1 - s / (whole + 4)));
      ctx.fillRect(column.x, y, column.width, height);
    }
  }
};

/* -------------------------------------------------------------- UI texture */

const drawTexture = (
  ctx: CanvasRenderingContext2D,
  palette: Palette,
): void => {
  ctx.textAlign = "left";
  ctx.textBaseline = "middle";
  for (const block of TEXTURE_BLOCKS) {
    ctx.fillStyle = hexA(palette.uiTexture, block.alpha);
    if (block.kind === "bars") {
      const slot = block.width / block.values.length;
      for (let i = 0; i < block.values.length; i++) {
        const h = block.height * block.values[i];
        ctx.fillRect(block.x + i * slot, block.y + block.height - h, slot * 0.55, h);
      }
    } else if (block.kind === "ticks") {
      const slot = block.width / block.values.length;
      ctx.fillRect(block.x, block.y + block.height, block.width, 1.6);
      for (let i = 0; i < block.values.length; i++) {
        const h = block.height * (0.3 + 0.7 * block.values[i]);
        ctx.fillRect(block.x + i * slot, block.y + block.height - h, 1.6, h);
      }
    } else {
      ctx.font = `500 21px ${LABEL_FONT}`;
      ctx.fillText(block.text, block.x, block.y + block.height * 0.5);
      ctx.fillRect(block.x, block.y + block.height * 1.3, block.width, 1.4);
    }
  }
};

/* ------------------------------------------------------------------ export */

/**
 * The whole display floats very slowly, under 2% of the frame, returning
 * toward where it started. On a curved surface even this reads as a large
 * object moving.
 */
export const driftAt = (frame: number): { x: number; y: number } => ({
  x:
    Math.sin((frame / 430) * TAU) * FLAT_WIDTH * 0.011 +
    Math.sin((frame / 233) * TAU + 1.2) * FLAT_WIDTH * 0.0035,
  y:
    Math.sin((frame / 367) * TAU + 0.6) * FLAT_HEIGHT * 0.009 +
    Math.sin((frame / 149) * TAU) * FLAT_HEIGHT * 0.003,
});

export const drawFlat = (
  ctx: CanvasRenderingContext2D,
  frame: number,
  palette: Palette,
): void => {
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.globalAlpha = 1;
  ctx.globalCompositeOperation = "source-over";
  ctx.shadowBlur = 0;

  drawField(ctx, palette, frame);

  const drift = driftAt(frame);
  ctx.save();
  ctx.translate(drift.x, drift.y);

  drawGrid(ctx, palette);
  drawDots(ctx, palette, frame);
  drawTexture(ctx, palette);
  drawCharts(ctx, palette, frame);
  drawArcs(ctx, palette, frame);
  drawBars(ctx, palette, frame);

  ctx.restore();
  ctx.shadowBlur = 0;
};
