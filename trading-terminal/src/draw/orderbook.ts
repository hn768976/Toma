import { Clock, priceAtTick, Series, TICK_FRAMES } from "../engine/data";
import { clamp, easeOutCubic, hash01, lerp } from "../engine/random";
import { Version } from "../engine/versions";
import { alpha, C } from "../theme";
import { fmt } from "./chart";
import { hline, Painter, Rect, roundRect, text } from "./primitives";

/**
 * Ladder centre trails the price (5-tick average, interpolated between ticks)
 * so the highlighted row drifts around the middle and the ladder re-centres
 * smoothly. The chart in the same shot centres on it too.
 */
export const ladderCentre = (s: Series, clock: Clock, step = 10, maxRows = 3) => {
  const avg = (tk: number) => {
    let sum = 0;
    for (let j = 0; j < 5; j++) sum += priceAtTick(s, tk - j);
    return sum / 5;
  };
  const sub = (clock.g - clock.tick * TICK_FRAMES) / TICK_FRAMES;
  const trail = lerp(avg(clock.tick - 1), avg(clock.tick), sub);
  // Soft-limit how far the live price may sit from the ladder centre so the
  // highlighted row always stays within ~maxRows of the middle.
  const p = priceAtTick(s, clock.tick);
  const lim = step * maxRows;
  return p - lim * Math.tanh((p - trail) / lim);
};

/**
 * Order book ladder: fixed price levels, asks (red) above the live price,
 * bids (green) below, current price highlighted between them. The ladder
 * recentres on each candle close; within a candle the highlight moves.
 */
export const drawOrderBook = (
  p: Painter,
  v: Version,
  s: Series,
  clock: Clock,
  r: Rect,
  o: { fs: number; rowH: number; step: number; decimals: number; midY?: number },
) => {
  const { ctx } = p;
  const g = clock.g;
  const price = priceAtTick(s, clock.tick);
  const centre = ladderCentre(s, clock, o.step);
  const lc = centre / o.step;
  const lp = Math.round(price / o.step);
  const head = o.fs * 2.4;
  const body: Rect = { x: r.x, y: r.y + head, w: r.w, h: r.h - head };
  const midY = o.midY ?? body.y + body.h / 2;
  const yOfL = (L: number) => midY - (L - lc) * o.rowH;
  const colS = r.x + r.w * 0.68;
  const colT = r.x + r.w - o.fs * 0.6;

  text(p, "Price", r.x + 8 + r.w * 0.5 - o.fs * 0.4, r.y + head * 0.5, o.fs * 0.8, C.textDim, { align: "right" });
  text(p, "Size", colS + r.w * 0.08, r.y + head * 0.5, o.fs * 0.8, C.textDim, { align: "right" });
  text(p, "Total", colT, r.y + head * 0.5, o.fs * 0.8, C.textDim, { align: "right" });
  hline(p, r.x, r.x + r.w, body.y, C.line, 2);

  const bear = v.drift < 0;
  const sizeOf = (L: number, ask: boolean) => {
    const base = ask === bear ? 0.55 : 1.2; // trend side refreshes faster
    const period = Math.max(8, Math.round((16 + hash01(L, 3, v.seed) * 50) * base));
    const phase = Math.floor(hash01(L, 4, v.seed) * period);
    const e = Math.floor((g + phase) / period);
    const since = g + phase - e * period;
    const sz = (u: number) => (0.15 + 3.2 * u * u) * (1 + 0.05 * Math.abs(L - lp));
    const now = sz(hash01(L * 7 + (ask ? 1 : 2), e, v.seed));
    const before = sz(hash01(L * 7 + (ask ? 1 : 2), e - 1, v.seed));
    return { now, grew: now >= before, flash: clamp(1 - since / 9) };
  };

  const maxRows = Math.ceil(body.h / o.rowH / 2) + 2;
  const rows: { L: number; ask: boolean; y: number; size: number; cum: number; grew: boolean; flash: number }[] = [];
  let cumA = 0;
  for (let k = 1; k <= maxRows + Math.abs(lp - Math.round(lc)) + 2; k++) {
    const L = lp + k;
    const sz = sizeOf(L, true);
    cumA += sz.now;
    rows.push({ L, ask: true, y: yOfL(L), size: sz.now, cum: cumA, grew: sz.grew, flash: sz.flash });
  }
  let cumB = 0;
  for (let k = 1; k <= maxRows + Math.abs(lp - Math.round(lc)) + 2; k++) {
    const L = lp - k;
    const sz = sizeOf(L, false);
    cumB += sz.now;
    rows.push({ L, ask: false, y: yOfL(L), size: sz.now, cum: cumB, grew: sz.grew, flash: sz.flash });
  }
  const maxCum = Math.max(cumA, cumB) * 0.5;

  ctx.save();
  ctx.beginPath();
  ctx.rect(body.x, body.y, body.w, body.h);
  ctx.clip();
  for (const row of rows) {
    if (row.y < body.y - o.rowH || row.y > body.y + body.h + o.rowH) continue;
    const col = row.ask ? C.red : C.green;
    const y0 = row.y - o.rowH / 2;
    // Depth bar: cumulative size, thin, growing from the right edge
    const dw = clamp(row.cum / maxCum) * r.w * 0.55;
    ctx.fillStyle = alpha(col, p.glow ? 0.06 : 0.12);
    ctx.fillRect(r.x + r.w - dw, y0 + o.rowH * 0.36, dw, o.rowH * 0.28);
    // A row that just changed flashes: the price lights up white-hot with a
    // short glow strip behind it.
    const f = row.flash;
    const cellW = r.w * 0.5;
    if (f > 0) {
      ctx.save();
      roundRect(ctx, r.x + 8, y0 + o.rowH * 0.22, cellW, o.rowH * 0.56, o.rowH * 0.1);
      ctx.fillStyle = col;
      ctx.globalAlpha = (p.glow ? 0.9 : 0.45) * f;
      ctx.fill();
      ctx.restore();
    }
    const pr = row.L * o.step;
    text(p, fmt(pr, o.decimals), r.x + 8 + cellW - o.fs * 0.4, row.y, o.fs, f > 0.4 ? "#FFE9EC" : col, { mono: true, align: "right", weight: 700, glow: true });
    text(p, row.size.toFixed(4), colS + r.w * 0.08, row.y, o.fs * 0.9, row.grew && f > 0 ? col : C.text, { mono: true, align: "right" });
    text(p, row.cum.toFixed(3), colT, row.y, o.fs * 0.82, C.textDim, { mono: true, align: "right" });
  }
  ctx.restore();

  // Highlighted current-price row between asks and bids
  const ty = yOfL(lp);
  const dirUp = price >= s.candles[clock.live].o;
  const col = dirUp ? C.green : C.red;
  ctx.save();
  roundRect(ctx, r.x + 2, ty - o.rowH * 0.66, r.w - 4, o.rowH * 1.32, o.rowH * 0.18);
  ctx.fillStyle = C.bgDeep;
  ctx.fill();
  ctx.lineWidth = 4;
  ctx.strokeStyle = col;
  ctx.stroke();
  roundRect(ctx, r.x + 6, ty - o.rowH * 0.56, r.w * 0.5, o.rowH * 1.12, o.rowH * 0.16);
  ctx.fillStyle = p.glow ? alpha(col, 0.8) : col;
  ctx.fill();
  ctx.restore();
  text(p, fmt(price, o.decimals), r.x + 6 + r.w * 0.5 - o.fs * 0.4, ty, o.fs * 1.12, C.tagText, { mono: true, align: "right", weight: 700 });
  text(p, dirUp ? "▲" : "▼", r.x + r.w * 0.6, ty, o.fs * 0.8, col, { align: "center", glow: true });
  const spread = (hash01(clock.tick, 9, v.seed) * 4 + 1) * o.step * 0.1;
  text(p, `spr ${spread.toFixed(o.decimals)}`, colT, ty, o.fs * 0.85, C.text, { mono: true, align: "right", weight: 600 });
  return { yOfL, lp, lc, midY };
};

/** Recent trades column (far right, mostly out of focus). */
export const drawTrades = (
  p: Painter,
  v: Version,
  s: Series,
  clock: Clock,
  r: Rect,
  o: { fs: number; rowH: number; decimals: number },
) => {
  const { ctx } = p;
  const STEP = 4;
  const q = Math.floor(clock.g / STEP);
  const frac = easeOutCubic((clock.g - q * STEP) / 3);
  const head = o.fs * 2.4;
  text(p, "Trades", r.x + o.fs * 0.6, r.y + head * 0.5, o.fs * 0.85, C.textDim);
  hline(p, r.x, r.x + r.w, r.y + head, C.line, 2);
  ctx.save();
  ctx.beginPath();
  ctx.rect(r.x, r.y + head, r.w, r.h - head);
  ctx.clip();
  const bias = v.drift < 0 ? 0.64 : v.drift > 0 ? 0.36 : 0.5;
  const rows = Math.ceil((r.h - head) / o.rowH) + 1;
  for (let k = 0; k < rows; k++) {
    const id = q - k;
    const y = r.y + head + (k - 1 + frac) * o.rowH + o.rowH / 2;
    const sell = hash01(id, 21, v.seed) < bias;
    const col = sell ? C.red : C.green;
    const tick = Math.max(0, Math.floor((id * STEP) / TICK_FRAMES) - 7);
    const pr = priceAtTick(s, tick) + (hash01(id, 22, v.seed) - 0.5) * 6;
    const fresh = k === 0 ? 1 - frac : k === 1 ? Math.max(0, 0.6 - frac) : 0;
    if (fresh > 0) {
      ctx.fillStyle = alpha(col, (p.glow ? 0.3 : 0.2) * fresh);
      ctx.fillRect(r.x + 4, y - o.rowH * 0.45, r.w - 8, o.rowH * 0.9);
    }
    ctx.save();
    roundRect(ctx, r.x + 8, y - o.rowH * 0.38, r.w * 0.5, o.rowH * 0.76, o.rowH * 0.12);
    ctx.fillStyle = alpha(col, p.glow ? 0.16 : 0.2);
    ctx.fill();
    ctx.restore();
    text(p, fmt(pr, o.decimals), r.x + 8 + r.w * 0.5 - o.fs * 0.4, y, o.fs, col, { mono: true, align: "right", weight: 600, glow: true });
    text(p, (hash01(id, 23, v.seed) * 2.5).toFixed(4), r.x + r.w - o.fs * 0.6, y, o.fs * 0.9, C.text, {
      mono: true,
      align: "right",
    });
  }
  ctx.restore();
};

/** Liquidity heatmap: a grid of glowing dots, blue = resting size, teal/red = trades. */
export const drawHeatmap = (p: Painter, v: Version, clock: Clock, r: Rect, cell: number) => {
  const { ctx } = p;
  if (!p.glow) {
    ctx.save();
    roundRect(ctx, r.x, r.y, r.w, r.h, cell * 0.8);
    ctx.fillStyle = "#10275A";
    ctx.fill();
    ctx.restore();
  }
  ctx.save();
  roundRect(ctx, r.x, r.y, r.w, r.h, cell * 0.8);
  ctx.strokeStyle = C.blue;
  ctx.lineWidth = p.glow ? 14 : 6;
  ctx.globalAlpha = p.glow ? 0.9 : 0.85;
  ctx.stroke();
  ctx.restore();
  const cols = Math.floor((r.w - cell) / cell);
  const rows = Math.floor((r.h - cell) / cell);
  const shift = Math.floor(clock.g / 6);
  for (let j = 0; j < rows; j++) {
    for (let i = 0; i < cols; i++) {
      const col = i + shift; // columns scroll left as time passes
      const u = hash01(col * 131 + j, 31, v.seed);
      const band = Math.exp(-Math.pow((j - rows * (0.45 + 0.15 * Math.sin(col * 0.05))) / (rows * 0.22), 2));
      const k = u * (0.35 + 0.65 * band);
      if (k < 0.12) continue;
      const trade = hash01(col, j, v.seed + 7) > 0.93;
      const c = trade ? (hash01(col, j, 9) < (v.drift < 0 ? 0.65 : 0.35) ? C.red : C.green) : k > 0.6 ? "#B8D8FF" : k > 0.35 ? C.blue : "#2E6BFF";
      ctx.fillStyle = c;
      ctx.globalAlpha = (p.glow ? 0.9 : 1) * Math.min(1, k * 1.1);
      ctx.beginPath();
      ctx.arc(r.x + cell * (i + 1), r.y + cell * (j + 1), cell * (0.22 + 0.22 * k), 0, Math.PI * 2);
      ctx.fill();
    }
  }
  ctx.globalAlpha = 1;
};
