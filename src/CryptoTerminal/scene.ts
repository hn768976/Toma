import {random} from 'remotion';
import {
  AXIS_GROWTH,
  AXIS_RETURN_FRAME,
  BASE_PRICE,
  BODY_W,
  CAM_ANCHOR,
  CAM_ROTATION,
  CAM_SCALE,
  CAM_SHEAR_X,
  CAM_SHEAR_Y,
  COLORS,
  DURATION,
  HEIGHT,
  K_FAR,
  K_LABEL,
  LAYOUT,
  PITCH,
  PX_PER_LOG,
  SERIES_LEN,
  SLOPE_PX,
  VISIBLE_H,
  WICK_W,
  WIDTH,
} from './constants';
import {BLEED} from './dof';
import {Candle, wrap} from './series';

export type Fonts = {mono: string; sans: string};

type Mat = {a: number; b: number; c: number; d: number; e: number; f: number};

/** Applies B, then A. Canvas convention: x' = a·x + c·y + e, y' = b·x + d·y + f. */
const mul = (A: Mat, B: Mat): Mat => ({
  a: A.a * B.a + A.c * B.b,
  b: A.b * B.a + A.d * B.b,
  c: A.a * B.c + A.c * B.d,
  d: A.b * B.c + A.d * B.d,
  e: A.a * B.e + A.c * B.f + A.e,
  f: A.b * B.e + A.d * B.f + A.f,
});

/**
 * The camera: one affine transform, applied once.
 *
 * Rotation and shear together produce the reference's off-axis tilt — see the
 * note on CAM_ROTATION for why it takes both. Parallel lines stay parallel; at
 * this blur level a true projection would be indistinguishable.
 */
const cameraMatrix = (): Mat => {
  const cos = Math.cos(CAM_ROTATION);
  const sin = Math.sin(CAM_ROTATION);
  const toBuffer: Mat = {a: 1, b: 0, c: 0, d: 1, e: BLEED + WIDTH / 2, f: BLEED + HEIGHT / 2};
  const rotate: Mat = {a: cos, b: sin, c: -sin, d: cos, e: 0, f: 0};
  const shear: Mat = {a: 1, b: CAM_SHEAR_Y, c: CAM_SHEAR_X, d: 1, e: 0, f: 0};
  const scale: Mat = {a: CAM_SCALE, b: 0, c: 0, d: CAM_SCALE, e: 0, f: 0};
  const toAnchor: Mat = {a: 1, b: 0, c: 0, d: 1, e: -CAM_ANCHOR.x, f: -CAM_ANCHOR.y};
  return mul(mul(mul(mul(toBuffer, rotate), shear), scale), toAnchor);
};

// ── Timeline ──────────────────────────────────────────────────────────────

const smootherstep = (x: number) => {
  const t = x < 0 ? 0 : x > 1 ? 1 : x;
  return t * t * t * (t * (t * 6 - 15) + 10);
};

/**
 * The axis ramp. Climbs near-linearly for AXIS_RETURN_FRAME frames, then eases
 * back to zero so the labels at frame 1620 match frame 0 exactly. The return is
 * smootherstepped, so it arrives with zero slope and the loop point shows no
 * kick — the cost is a visible rewind of the numerals over the last two seconds.
 */
const axisRamp = (frame: number): number => {
  if (frame <= AXIS_RETURN_FRAME) {
    return smootherstep(frame / AXIS_RETURN_FRAME) * 0.06 + (frame / AXIS_RETURN_FRAME) * 0.94;
  }
  return 1 - smootherstep((frame - AXIS_RETURN_FRAME) / (DURATION - AXIS_RETURN_FRAME));
};

/** Log-price sitting on the y-anchor line at this frame. */
const axisCentre = (frame: number) => Math.log(BASE_PRICE) + AXIS_GROWTH * axisRamp(frame);

/** Scroll position, in candles. Advances exactly SERIES_LEN over the loop. */
const scrollAt = (frame: number) => (frame / DURATION) * SERIES_LEN;

// ── Geometry ──────────────────────────────────────────────────────────────

/** Design-space x of the centre of candle j at scroll s. */
const candleX = (j: number, s: number) => LAYOUT.axisX - (s - j) * PITCH;

/** Design-space y of relative log-level `level` on candle j at scroll s. */
const candleY = (j: number, s: number, level: number) =>
  LAYOUT.yAnchor - (j - s) * SLOPE_PX - level * PX_PER_LOG;

/** Reads a price off a design-space y, through the displayed-axis mapping. */
const priceAtY = (y: number, frame: number) =>
  Math.exp(axisCentre(frame) + (LAYOUT.yAnchor - y) / K_LABEL);

/** Inverse: the design-space y a given price lands on. */
const yAtPrice = (price: number, frame: number) =>
  LAYOUT.yAnchor - (Math.log(price) - axisCentre(frame)) * K_LABEL;

// ── Formatting ────────────────────────────────────────────────────────────

const group = (n: number) => String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
/** "5,000.000" — the reference's thousands-and-three-decimals axis format. */
const axisLabel = (v: number) => `${group(Math.round(v))}.000`;

/** Picks a round grid step giving roughly `target` rules over `span`. */
const niceStep = (span: number, target: number) => {
  const raw = span / target;
  const mag = 10 ** Math.floor(Math.log10(raw));
  for (const m of [1, 2, 2.5, 5, 10]) {
    if (raw <= mag * m) return mag * m;
  }
  return mag * 10;
};

// ── The forming candle ────────────────────────────────────────────────────

type LiveCandle = {open: number; close: number; high: number; low: number};

/**
 * The rightmost candle is still printing: its close drifts, so the body grows,
 * shrinks and can flip colour until the scroll locks it. The wobble decays to
 * zero as the candle completes, so it joins the locked series without a jump.
 */
const formingCandle = (base: Candle, index: number, p: number): LiveCandle => {
  const phase = random(`form-phase-${index}`) * Math.PI * 2;
  const amp = (0.004 + random(`form-amp-${index}`) * 0.009) * (1 - p) ** 1.4;
  const wobble =
    Math.sin(p * Math.PI * 2 * 2.5 + phase) * amp +
    Math.sin(p * Math.PI * 2 * 6.5 + phase * 1.7) * amp * 0.35;
  const close = base.open + (base.close - base.open) * smootherstep(p) + wobble;
  const reach = smootherstep(Math.min(1, p * 1.25));
  return {
    open: base.open,
    close,
    high: Math.max(base.open, close, base.open + (base.high - base.open) * reach),
    low: Math.min(base.open, close, base.open + (base.low - base.open) * reach),
  };
};

// ── Drawing helpers ───────────────────────────────────────────────────────

const roundRect = (
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number
) => {
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, r);
};

const line = (ctx: CanvasRenderingContext2D, x1: number, y1: number, x2: number, y2: number) => {
  ctx.beginPath();
  ctx.moveTo(x1, y1);
  ctx.lineTo(x2, y2);
  ctx.stroke();
};

// ── Scene ─────────────────────────────────────────────────────────────────

// Truncated the way a narrow column would truncate them.
const TICKERS = [
  'BTC-U..', 'ETH-U..', 'XRP-U..', 'LTC-U..', 'ADA-U..', 'SOL-U..', 'DOT-U..',
  'LINK-..', 'XLM-U..', 'DOGE-..', 'BCH-U..', 'ATOM-..', 'AVAX-..', 'ALGO-..',
  'TRX-U..', 'FIL-U..',
];
const ICON_COLORS = [
  '#F2A33C',
  '#6C7A89',
  COLORS.blue,
  COLORS.green,
  '#8B7BD8',
  COLORS.red,
];
const SIDEBAR_ROWS = 15;

/**
 * Draws the whole UI into the master buffer, in design space.
 * Called once per frame; the DOF stack takes it from here.
 */
export const drawScene = (
  ctx: CanvasRenderingContext2D,
  frame: number,
  series: Candle[],
  fonts: Fonts
) => {
  const s = scrollAt(frame);
  const head = Math.floor(s) + 1; // the forming candle
  const p = s - Math.floor(s);
  const m = cameraMatrix();
  ctx.setTransform(m.a, m.b, m.c, m.d, m.e, m.f);
  ctx.lineCap = 'butt';
  ctx.textBaseline = 'alphabetic';

  const live = formingCandle(series[wrap(head, SERIES_LEN)], wrap(head, SERIES_LEN), p);
  const at = (j: number): Candle | LiveCandle =>
    j === head ? live : series[wrap(j, SERIES_LEN)];

  drawGrid(ctx, frame, s, fonts);
  drawVolume(ctx, s, head, series);
  drawCandles(ctx, s, head, at);
  drawPriceMarker(ctx, frame, s, head, live, fonts);
  drawSecondaryChart(ctx, s, series);
  drawSidebar(ctx, frame, fonts);
  drawFarAxis(ctx, frame, fonts);
};

// ── Grid and y-axis ───────────────────────────────────────────────────────

const drawGrid = (
  ctx: CanvasRenderingContext2D,
  frame: number,
  s: number,
  fonts: Fonts
) => {
  const top = -1400;
  const bottom = 3400;
  // Step is chosen from the in-shot span so ~5 rules are visible, then applied
  // across the whole design surface.
  const mid = LAYOUT.yAnchor;
  const inShot = priceAtY(mid - VISIBLE_H / 2, frame) - priceAtY(mid + VISIBLE_H / 2, frame);
  const step = niceStep(inShot, 5);

  // Faint vertical rules, scrolling in lockstep with the candles. The column
  // spacing has to DIVIDE SERIES_LEN, or the rules land on different candles at
  // frame 0 and frame 1620 and the loop stops being pixel-exact.
  ctx.strokeStyle = COLORS.rule;
  ctx.lineWidth = 2;
  const COLUMN_SPACING = 13; // 260 / 20
  const firstCol = Math.ceil((s - 130) / COLUMN_SPACING) * COLUMN_SPACING;
  for (let j = firstCol; j <= s + COLUMN_SPACING; j += COLUMN_SPACING) {
    const x = candleX(j, s);
    if (x < LAYOUT.chartLeft || x > LAYOUT.gridRight) continue;
    line(ctx, x, top, x, bottom);
  }

  // Horizontal rules with right-aligned tabular labels.
  ctx.font = `400 40px ${fonts.mono}`;
  ctx.textAlign = 'right';
  const first = Math.ceil(priceAtY(bottom, frame) / step) * step;
  for (let v = first; v < priceAtY(top, frame); v += step) {
    const y = yAtPrice(v, frame);
    ctx.strokeStyle = COLORS.rule;
    ctx.lineWidth = 2.5;
    line(ctx, LAYOUT.chartLeft, y, LAYOUT.gridRight, y);
    ctx.fillStyle = COLORS.text;
    ctx.fillText(axisLabel(v), LAYOUT.labelRight, y - 14);
  }
  ctx.textAlign = 'left';
};

// ── Volume histogram ──────────────────────────────────────────────────────

const drawVolume = (
  ctx: CanvasRenderingContext2D,
  s: number,
  head: number,
  series: Candle[]
) => {
  // Low contrast on purpose — this is secondary information.
  for (let j = head - 132; j <= head; j++) {
    const c = series[wrap(j, SERIES_LEN)];
    const x = candleX(j, s);
    if (x < LAYOUT.chartLeft - PITCH || x > LAYOUT.gridRight + PITCH) continue;
    const base = LAYOUT.volumeBase;
    const h = Math.max(6, c.volume * LAYOUT.volumeMax);
    ctx.fillStyle = c.close >= c.open ? 'rgba(38,166,106,0.30)' : 'rgba(217,69,92,0.30)';
    ctx.fillRect(x - 3, base - h, 6, h);
  }
};

// ── Candles ───────────────────────────────────────────────────────────────

const drawCandles = (
  ctx: CanvasRenderingContext2D,
  s: number,
  head: number,
  at: (j: number) => Candle | LiveCandle
) => {
  for (let j = head - 132; j <= head; j++) {
    const x = candleX(j, s);
    if (x < LAYOUT.chartLeft - PITCH || x > LAYOUT.gridRight + PITCH) continue;
    const c = at(j);
    const up = c.close >= c.open;
    const color = up ? COLORS.green : COLORS.red;
    const yHigh = candleY(j, s, c.high);
    const yLow = candleY(j, s, c.low);
    const yOpen = candleY(j, s, c.open);
    const yClose = candleY(j, s, c.close);

    ctx.fillStyle = color;
    // Wick first, so the solid body sits on top of it.
    ctx.fillRect(x - WICK_W / 2, yHigh, WICK_W, yLow - yHigh);
    const top = Math.min(yOpen, yClose);
    const h = Math.max(3, Math.abs(yClose - yOpen));
    ctx.fillRect(x - BODY_W / 2, top, BODY_W, h);
  }
};

// ── Price tag and its dashed rule ─────────────────────────────────────────

const drawPriceMarker = (
  ctx: CanvasRenderingContext2D,
  frame: number,
  s: number,
  head: number,
  live: LiveCandle,
  fonts: Fonts
) => {
  const y = candleY(head, s, live.close);
  const rising = live.close >= live.open;
  const color = rising ? COLORS.green : COLORS.red;
  const label = priceAtY(y, frame).toFixed(3);

  ctx.strokeStyle = color;
  ctx.globalAlpha = 0.55;
  ctx.lineWidth = 2.5;
  ctx.setLineDash([15, 13]);
  line(ctx, LAYOUT.chartLeft, y, LAYOUT.labelRight, y);
  ctx.setLineDash([]);
  ctx.globalAlpha = 1;

  ctx.font = `500 38px ${fonts.mono}`;
  const w = ctx.measureText(label).width + 34;
  const h = 58;
  ctx.fillStyle = color;
  roundRect(ctx, LAYOUT.labelRight + 16 - w, y - h / 2, w, h, 7);
  ctx.fill();
  ctx.fillStyle = '#FFFFFF';
  ctx.textAlign = 'right';
  ctx.fillText(label, LAYOUT.labelRight - 1, y + 14);
  ctx.textAlign = 'left';
};

// ── Secondary chart, cropped by the right edge ────────────────────────────

/**
 * A second, larger chart peeking out from behind the sidebar. It is always deep
 * in the right-hand blur zone, so it reads as depth rather than as detail.
 */
const drawSecondaryChart = (ctx: CanvasRenderingContext2D, s: number, series: Candle[]) => {
  const pitch = 34;
  const scale = pitch / PITCH;
  ctx.globalAlpha = 0.5;
  for (let k = 0; k <= 26; k++) {
    const j = Math.floor(s) - k + 130;
    const c = series[wrap(j, SERIES_LEN)];
    const x = LAYOUT.divider2 + 190 - k * pitch - (s % 1) * pitch;
    if (x < LAYOUT.divider2 - 130) continue;
    const y0 = 640 - (j - s - 130) * SLOPE_PX * scale;
    const yy = (level: number) => y0 - level * PX_PER_LOG * scale * 1.6;
    const up = c.close >= c.open;
    ctx.fillStyle = up ? COLORS.green : COLORS.red;
    ctx.fillRect(x - 2, yy(c.high), 4, yy(c.low) - yy(c.high));
    const top = Math.min(yy(c.open), yy(c.close));
    ctx.fillRect(x - 12, top, 24, Math.max(4, Math.abs(yy(c.close) - yy(c.open))));
  }
  ctx.globalAlpha = 1;
};

// ── Sidebar ───────────────────────────────────────────────────────────────

const drawSidebar = (ctx: CanvasRenderingContext2D, frame: number, fonts: Fonts) => {
  const x = LAYOUT.sidebarX;

  ctx.strokeStyle = COLORS.rule;
  ctx.lineWidth = 3;
  line(ctx, LAYOUT.divider1, -1400, LAYOUT.divider1, 3400);
  line(ctx, LAYOUT.divider2, -1400, LAYOUT.divider2, 3400);

  // A second column header, clipped by the top of the frame.
  ctx.font = `500 34px ${fonts.sans}`;
  ctx.fillStyle = COLORS.text;
  ctx.fillText('Symbol', x, 330);
  ctx.fillText('Last P...', x + 150, 330);
  ctx.strokeStyle = COLORS.rule;
  ctx.lineWidth = 2.5;
  line(ctx, LAYOUT.divider1, 372, LAYOUT.divider2, 372);

  ctx.font = `500 58px ${fonts.sans}`;
  ctx.fillStyle = COLORS.text;
  ctx.fillText('Cryptocurrencies', x, 530);

  ctx.font = `400 28px ${fonts.sans}`;
  ctx.fillStyle = COLORS.mid;
  ctx.fillText('Symbol', x + 4, 630);
  ctx.fillText('Last P...', x + 150, 630);
  ctx.strokeStyle = COLORS.rule;
  ctx.lineWidth = 2.5;
  line(ctx, LAYOUT.divider1, 660, LAYOUT.divider2, 660);

  const rowTop = 730;
  const pitch = 68;

  for (let i = 0; i < SIDEBAR_ROWS; i++) {
    const y = rowTop + i * pitch;
    ctx.fillStyle = ICON_COLORS[i % ICON_COLORS.length];
    ctx.globalAlpha = 0.75;
    ctx.beginPath();
    ctx.arc(x + 14, y - 9, 12, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;

    // Text is deliberately small and low-contrast — it is texture, not copy.
    ctx.font = `400 26px ${fonts.mono}`;
    ctx.fillStyle = COLORS.mid;
    ctx.fillText(TICKERS[i % TICKERS.length], x + 34, y);

    const value = 40 + random(`row-price-${i}`) * 48000;
    ctx.font = `400 20px ${fonts.mono}`;
    ctx.textAlign = 'right';
    ctx.fillStyle = COLORS.text;
    ctx.globalAlpha = 0.55;
    ctx.fillText(
      group(Math.round(value)) + '.' + String(Math.floor(random(`row-dec-${i}`) * 900) + 100),
      x + 258,
      y
    );
    ctx.globalAlpha = 1;

    // A few rows carry a small signed percentage.
    if (random(`row-pct-${i}`) > 0.42) {
      const pct = (random(`row-pctv-${i}`) - 0.42) * 9;
      ctx.font = `400 18px ${fonts.mono}`;
      ctx.fillStyle = pct >= 0 ? COLORS.green : COLORS.red;
      // One row at a time dims, as if its quote had just ticked. The cycle is
      // 18 steps of 90 frames — exactly DURATION — so it closes on the loop.
      ctx.globalAlpha = i === Math.floor(frame / 90) % 18 ? 0.55 : 1;
      ctx.fillText(`${pct >= 0 ? '+' : ''}${pct.toFixed(2)}%`, x + 258, y + 26);
      ctx.globalAlpha = 1;
    }
    ctx.textAlign = 'left';
  }
};

// ── Far-right cropped axis ────────────────────────────────────────────────

const drawFarAxis = (ctx: CanvasRenderingContext2D, frame: number, fonts: Fonts) => {
  const top = -1400;
  const bottom = 3400;
  const priceAt = (y: number) =>
    Math.exp(axisCentre(frame) + (LAYOUT.yAnchor - y) / K_FAR);
  const yAt = (v: number) => LAYOUT.yAnchor - (Math.log(v) - axisCentre(frame)) * K_FAR;

  const mid = LAYOUT.yAnchor;
  const step = niceStep(priceAt(mid - VISIBLE_H / 2) - priceAt(mid + VISIBLE_H / 2), 3);
  ctx.font = `400 170px ${fonts.mono}`;
  ctx.fillStyle = COLORS.mid;
  ctx.strokeStyle = COLORS.rule;
  ctx.lineWidth = 5;
  const first = Math.ceil(priceAt(bottom) / step) * step;
  for (let v = first; v < priceAt(top); v += step) {
    const y = yAt(v);
    line(ctx, LAYOUT.farAxisX - 96, y, LAYOUT.farAxisX - 34, y);
    ctx.fillText(axisLabel(v), LAYOUT.farAxisX, y + 58);
  }
};
