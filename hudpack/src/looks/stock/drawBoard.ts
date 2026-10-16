import { INTER } from "../../lib/fonts";
import { LOOP, LoopNoise, tick, tickTable } from "../../lib/loop";
import { gauss, mulberry32 } from "../../lib/random";
import type { StockPalette } from "../../versions";
import { TICKERS } from "./tickers";

// The board texture, in design units of 3000 x 1000 (the plane is 3:1).
// Redrawn every frame from formulas of the frame; nothing is accumulated.
export const BOARD_W = 3000;
export const BOARD_H = 1000;

const rng = mulberry32(0x570c4);
const PERIODS = [10, 12, 15, 20, 24, 25, 30, 40, 50, 60, 75, 100, 120];

interface Quote {
  sym: string;
  period: number;
  price: string[];
  change: number[];
}

const makeQuote = (sym: string): Quote => {
  const period = PERIODS[Math.floor(rng() * PERIODS.length)];
  const base = 5 + rng() * 120;
  const n = LOOP / period;
  const raw = Array.from({ length: n }, () => base * (1 + gauss(rng) * 0.01));
  return {
    sym,
    period,
    price: raw.map((v) => v.toFixed(2)),
    change: raw.map((v, i) => {
      const d = v - raw[(i - 1 + n) % n];
      const mag = Math.abs(d) < 0.01 ? 0.01 + rng() * 0.3 : Math.abs(d);
      return (d >= 0 ? 1 : -1) * Number(mag.toFixed(rng() < 0.5 ? 2 : 3));
    }),
  };
};

let tIdx = 0;
const nextSym = () => TICKERS[tIdx++ % TICKERS.length];

// Rows of quotes: [y, fontSize, alpha, count]
const ROWS: { y: number; size: number; alpha: number; quotes: Quote[]; x0: number }[] = [
  { y: 232, size: 25, alpha: 1, x0: 10 },
  { y: 292, size: 16, alpha: 0.55, x0: 40 },
  { y: 322, size: 14, alpha: 0.4, x0: -20 },
  { y: 420, size: 14, alpha: 0.42, x0: 260 },
  { y: 540, size: 15, alpha: 0.45, x0: -40 },
  { y: 660, size: 14, alpha: 0.42, x0: 120 },
  { y: 806, size: 15, alpha: 0.5, x0: 30 },
  { y: 845, size: 23, alpha: 0.95, x0: -60 },
  { y: 900, size: 17, alpha: 0.6, x0: 0 },
  { y: 955, size: 21, alpha: 0.8, x0: -30 },
  { y: 990, size: 14, alpha: 0.45, x0: 15 },
].map((r) => ({ ...r, quotes: Array.from({ length: 22 }, () => makeQuote(nextSym())) }));

// Small number grid at the top: 4 rows x 33 columns.
const GRID = Array.from({ length: 4 }, (_, r) =>
  Array.from({ length: 33 }, () => {
    const period = PERIODS[Math.floor(rng() * PERIODS.length)];
    const dec = [2, 4, 7, 2][r];
    const base = r === 2 ? rng() * 0.1 : 1 + rng() * 99;
    const signed = rng() < 0.3;
    return {
      period,
      table: tickTable(period, () => {
        const v = base * (1 + gauss(rng) * 0.01);
        return (signed ? (rng() < 0.5 ? "+" : "-") : "") + v.toFixed(dec);
      }),
      tone: rng(),
    };
  }),
);

// Left labels inside the chart area.
const SIDE = Array.from({ length: 7 }, () => makeQuote(nextSym()));

// Right block: dense coloured columns.
const RIGHT = Array.from({ length: 16 }, () =>
  Array.from({ length: 6 }, () => ({ q: makeQuote(nextSym()), kind: Math.floor(rng() * 3) })),
);

// Price line: one periodic seeded series, exactly one board width long.
const N = 780;
const series = (() => {
  const v = new Float64Array(N + 1);
  let x = 0;
  for (let i = 0; i <= N; i++) {
    v[i] = x;
    x += gauss(rng) * (rng() < 0.08 ? 3.6 : 1.2);
  }
  const drift = v[N] - v[0];
  for (let i = 0; i <= N; i++) v[i] -= (drift * i) / N;
  // several periodic swings so the chart is busy with no overall trend
  for (let i = 0; i <= N; i++) {
    const u = (2 * Math.PI * i) / N;
    v[i] += 6 * Math.sin(3 * u + 1.3) + 5 * Math.sin(5 * u + 0.4) + 3 * Math.sin(8 * u + 2.2);
  }
  let lo = Infinity;
  let hi = -Infinity;
  for (let i = 0; i < N; i++) {
    lo = Math.min(lo, v[i]);
    hi = Math.max(hi, v[i]);
  }
  const out = new Float32Array(N);
  for (let i = 0; i < N; i++) out[i] = (v[i] - lo) / (hi - lo);
  return out;
})();
const spread = Array.from({ length: N }, () => 0.012 + Math.abs(gauss(rng)) * 0.035);
// a second, dimmer series overlapping the first
const series2 = Array.from({ length: N }, (_, i) => {
  const u = (2 * Math.PI * i) / N;
  return 0.5 + 0.28 * Math.sin(4 * u + 0.7) + 0.12 * Math.sin(11 * u + 1.9) + 0.06 * Math.sin(29 * u);
});
// bright glints on the far side (they become soft bokeh in the blur)
const GLINTS = Array.from({ length: 60 }, () => ({
  x: 1950 + rng() * 1000,
  y: 40 + rng() * 920,
  r: 4 + rng() * 6,
  c: Math.floor(rng() * 3),
  period: PERIODS[Math.floor(rng() * PERIODS.length)] * 2,
  ph: rng(),
}));
const CANDLE_GLYPHS = Array.from({ length: 120 }, () => ({ o: rng(), c: rng(), h: rng() * 0.5, l: rng() * 0.5 }));
const spark = new LoopNoise(rng, 260, 0);
const spark2 = new LoopNoise(rng, 180, 1);

// ---------------------------------------------------------------- draw

const font = (size: number, weight = 400) => `${weight} ${size}px "${INTER}"`;

const triangle = (ctx: CanvasRenderingContext2D, x: number, y: number, s: number, up: boolean) => {
  ctx.beginPath();
  if (up) {
    ctx.moveTo(x, y - s * 0.75);
    ctx.lineTo(x + s * 0.55, y + s * 0.2);
    ctx.lineTo(x - s * 0.55, y + s * 0.2);
  } else {
    ctx.moveTo(x, y + s * 0.2);
    ctx.lineTo(x + s * 0.55, y - s * 0.75);
    ctx.lineTo(x - s * 0.55, y - s * 0.75);
  }
  ctx.closePath();
  ctx.fill();
};

/** Slot width of one quote, as a multiple of its font size. */
const SLOT = 11.8;

/**
 * One quote in a fixed slot: marker, coloured change, symbol, price. Fixed
 * offsets, so ticking digits never shift their neighbours.
 */
const drawQuote = (ctx: CanvasRenderingContext2D, q: Quote, x: number, y: number, size: number, f: number, p: StockPalette) => {
  const k = Math.floor(f / q.period) % q.price.length;
  const ch = q.change[k];
  const up = ch >= 0;
  ctx.fillStyle = up ? p.up : p.down;
  triangle(ctx, x + size * 0.35, y - size * 0.32, size * 0.55, up);
  ctx.font = font(size);
  ctx.fillText((up ? "+" : "") + ch.toString(), x + size * 0.85, y);
  ctx.fillStyle = p.text;
  ctx.font = font(size, 500);
  ctx.fillText(q.sym, x + size * 4.5, y);
  ctx.font = font(size);
  ctx.fillText(q.price[k].replace(".", " "), x + size * 7.75, y);
};

export const drawBoard = (ctx: CanvasRenderingContext2D, tw: number, f: number, p: StockPalette) => {
  const k = tw / BOARD_W;
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.clearRect(0, 0, tw, Math.round((tw * BOARD_H) / BOARD_W));
  ctx.setTransform(k, 0, 0, k, 0, 0);
  ctx.textBaseline = "alphabetic";
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  const lw = Math.max(1.3, 1 / k);

  // dim grid lines across the board
  ctx.strokeStyle = p.text;
  ctx.globalAlpha = 0.12;
  ctx.lineWidth = lw;
  for (let y = 340; y <= 780; y += 55) {
    ctx.setLineDash([3, 9]);
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(BOARD_W, y);
    ctx.stroke();
  }
  ctx.setLineDash([]);
  ctx.globalAlpha = 0.22;
  for (const y of [125, 195, 262, 320, 800, 870, 935]) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(BOARD_W, y);
    ctx.stroke();
  }
  for (let x = 250; x < BOARD_W; x += 250) {
    ctx.globalAlpha = 0.08;
    ctx.beginPath();
    ctx.moveTo(x, 330);
    ctx.lineTo(x, 790);
    ctx.stroke();
  }

  // small number grid (top band)
  ctx.fillStyle = p.text;
  GRID.forEach((row, r) => {
    row.forEach((c, i) => {
      const x = 12 + i * 92 + (r % 2) * 18;
      const y = 28 + r * 26;
      ctx.globalAlpha = 0.35 + c.tone * 0.4;
      ctx.font = font(r === 0 ? 20 : 15);
      const s = tick(c.table, c.period, f);
      if (s.startsWith("+") || s.startsWith("-")) ctx.fillStyle = s.startsWith("+") ? p.up : p.down;
      ctx.fillText(s, x, y);
      ctx.fillStyle = p.text;
    });
  });

  // upper band: tiny candle glyphs, a dot row and a faint line (scroll by whole periods)
  {
    const off = (f / LOOP) * 1500;
    ctx.strokeStyle = p.text;
    ctx.fillStyle = p.text;
    ctx.lineWidth = lw;
    ctx.globalAlpha = 0.7;
    for (let i = 0; i < 120; i++) {
      const x = ((i * 12.5 - off) % 1500 + 1500) % 1500;
      const g = CANDLE_GLYPHS[i];
      const base = 158 + spark.at(i * 2.2) * 10;
      const top = base - 9 * Math.max(g.o, g.c);
      const bot = base - 9 * Math.min(g.o, g.c);
      ctx.beginPath();
      ctx.moveTo(x, top - 6 * g.h);
      ctx.lineTo(x, bot + 6 * g.l);
      ctx.stroke();
      ctx.strokeRect(x - 2.5, top, 5, Math.max(1.5, bot - top));
    }
    ctx.globalAlpha = 0.55;
    for (let x = 0; x < 1500; x += 9) {
      ctx.beginPath();
      ctx.arc(x, 186 + spark2.at(x / 40) * 2, 1.8, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 0.35;
    ctx.beginPath();
    for (let x = 1530; x <= BOARD_W; x += 4) {
      const y = 165 + spark2.at((x - off * 2) / 9) * 18;
      if (x === 1530) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();
  }

  // strong panel rules and a vertical divider
  ctx.globalAlpha = 0.45;
  ctx.lineWidth = lw * 1.6;
  for (const y of [118, 262]) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(BOARD_W, y);
    ctx.stroke();
  }
  ctx.beginPath();
  ctx.moveTo(1700, 0);
  ctx.lineTo(1700, 262);
  ctx.stroke();
  ctx.lineWidth = lw;

  // axis numbers down the chart, time labels along its foot
  ctx.fillStyle = p.text;
  ctx.font = font(15);
  for (let i = 0; i < 8; i++) {
    ctx.globalAlpha = 0.5;
    ctx.fillText(String(150 - i * 10), 1180, 360 + i * 55);
    ctx.fillRect(1168, 355 + i * 55, 8, lw);
  }
  ctx.globalAlpha = 0.18;
  for (let y = 340; y < 780; y += 7) ctx.fillRect(1172, y, lw, 3);
  ctx.globalAlpha = 0.45;
  for (let i = 0; i < 12; i++) ctx.fillText(`${((i * 2 + 8) % 12) + 1}:00 ${i < 2 ? "AM" : "PM"}`, 60 + i * 245, 782);

  // far-side glints
  for (const g of GLINTS) {
    const tw = 0.5 + 0.5 * Math.sin(2 * Math.PI * (f / g.period + g.ph));
    ctx.globalAlpha = 0.45 + 0.55 * tw;
    ctx.fillStyle = g.c === 0 ? "#ffffff" : g.c === 1 ? p.down : p.text;
    ctx.beginPath();
    ctx.arc(g.x, g.y, g.r, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.fillStyle = p.text;

  // quote rows
  ctx.globalAlpha = 1;
  for (const row of ROWS) {
    ctx.globalAlpha = row.alpha;
    row.quotes.forEach((q, i) => {
      const x = row.x0 + i * row.size * SLOT;
      if (x < BOARD_W) drawQuote(ctx, q, x, row.y, row.size, f, p);
    });
  }

  // side labels in the chart area
  SIDE.forEach((q, i) => {
    ctx.globalAlpha = 0.7;
    drawQuote(ctx, q, 14, 370 + i * 62, 16, f, p);
  });

  // right block of dense coloured columns
  RIGHT.forEach((col, ci) => {
    col.forEach((cell, ri) => {
      const x = 2180 + ci * 50;
      const y = 360 + ri * 62 + (ci % 2) * 20;
      const kq = Math.floor(f / cell.q.period) % cell.q.price.length;
      ctx.globalAlpha = 0.65;
      ctx.font = font(15);
      ctx.fillStyle = cell.kind === 0 ? p.text : cell.q.change[kq] >= 0 ? p.up : p.down;
      ctx.fillText(cell.kind === 0 ? cell.q.price[kq] : (cell.q.change[kq] >= 0 ? "+" : "") + cell.q.change[kq], x, y);
    });
  });

  // the price line: periodic series scrolled exactly one board width per loop
  {
    const dx = BOARD_W / N;
    const off = (f / LOOP) * BOARD_W;
    const yOf = (v: number) => 750 - v * 400;
    const vis = (x: number) => x >= -dx && x <= BOARD_W + dx;
    // second, faint series of short ticks behind (no smooth average line)
    ctx.strokeStyle = p.text;
    ctx.globalAlpha = 0.0;
    ctx.lineWidth = lw;
    ctx.beginPath();
    let first = true;
    for (let i = 0; i <= 2 * N; i++) {
      const x = i * dx - off;
      if (!vis(x)) continue;
      const y = yOf(series2[i % N] * 0.8 + series[i % N] * 0.2);
      if (first) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
      first = false;
    }
    ctx.stroke();
    // box-and-whisker bars (open = previous close)
    ctx.strokeStyle = p.priceLine;
    ctx.globalAlpha = 0.75;
    ctx.beginPath();
    for (let i = 1; i <= 2 * N; i++) {
      const x = i * dx - off;
      if (!vis(x)) continue;
      const v = series[i % N];
      const o = series[(i - 1) % N];
      const sp = spread[i % N];
      ctx.moveTo(x, yOf(Math.max(v, o) + sp));
      ctx.lineTo(x, yOf(Math.min(v, o) - sp));
      ctx.rect(x - dx * 0.3, yOf(Math.max(v, o)), dx * 0.6, Math.max(1, Math.abs(yOf(v) - yOf(o))));
    }
    ctx.stroke();
    const path = () => {
      ctx.beginPath();
      let first2 = true;
      for (let i = 0; i <= 2 * N; i++) {
        const x = i * dx - off;
        if (!vis(x)) continue;
        const y = yOf(series[i % N]);
        if (first2) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
        first2 = false;
      }
    };
    ctx.save();
    ctx.shadowColor = p.priceLine;
    ctx.shadowBlur = 5 * k;
    ctx.globalAlpha = 0.12;
    ctx.lineWidth = lw * 2.5;
    path();
    ctx.stroke();
    ctx.restore();
    ctx.globalAlpha = 0.7;
    ctx.lineWidth = Math.max(lw, 1.2);
    ctx.strokeStyle = p.priceLine;
    path();
    ctx.stroke();
  }
  ctx.globalAlpha = 1;
};
