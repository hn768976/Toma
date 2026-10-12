import { DrawFn } from "../lib/CanvasLook";
import { MONO, SANS } from "../lib/fonts";
import { cyc, hash3, hashF, holdBucket, loopFrame, mulberry32 } from "../lib/random";

export type TradingTerminalProps = {
  bg: string;
  panel: string;
  grid: string;
  up: string;
  down: string;
  text: string;
  bright: string;
  ma1: string;
  ma2: string;
  summary: [string, string, string, string];
  analysis: string;
};

// ------------------------------------------------------------ the series --
// Candle life is 20 frames, so 30 candles complete per 600-frame loop. For the
// loop to be exact the candle series is periodic in 30. The periodic part is
// a closed random walk; a smooth screen-space trend g(x) rides on top so the
// 140 visible candles never read as one pattern repeated.
const LIFE = 20;
const PERIOD = 30;
const VISIBLE = 140;
const rnd = mulberry32(0x1046951);
const BASE: { o: number; c: number; h: number; l: number; v: number; path: number[] }[] = [];
{
  const inc = Array.from({ length: PERIOD }, () => (rnd() - 0.5) * 4.6 + (rnd() < 0.18 ? (rnd() - 0.5) * 7 : 0));
  const mean = inc.reduce((a, b) => a + b, 0) / PERIOD;
  let p = 0;
  const closes = inc.map((d) => (p += d - mean));
  for (let k = 0; k < PERIOD; k++) {
    const o = closes[(k + PERIOD - 1) % PERIOD];
    const c = closes[k];
    // intra-candle path, 21 samples, ends exactly at c
    const path: number[] = [];
    const amp = 0.5 + rnd() * 1.3;
    const ph = rnd() * 6.28;
    for (let j = 0; j <= LIFE; j++) {
      const t = j / LIFE;
      path.push(o + (c - o) * t + amp * Math.sin(t * Math.PI) * Math.sin(ph + t * 9) );
    }
    const hi = Math.max(...path) + rnd() * 1.6;
    const lo = Math.min(...path) - rnd() * 1.6;
    BASE.push({ o, c, h: hi, l: lo, v: 0.08 + 0.92 * rnd() ** 2.2, path });
  }
}
/** Smooth trend over the chart width, u = 0 (left) … 1 (right edge). */
const trend = (u: number) => 1557 + 21 * u + 5.5 * Math.sin(u * 6.3 + 0.9) + 2.6 * Math.sin(u * 14.1 + 2.0);

type Candle = { x: number; o: number; c: number; h: number; l: number; v: number; live: boolean };

const candlesAt = (f: number, chartW: number, pitch: number, xRight: number): Candle[] => {
  const K = Math.floor(f / LIFE); // live candle index (mod PERIOD)
  const p = (f % LIFE) / LIFE;
  const j = f % LIFE;
  const out: Candle[] = [];
  for (let back = VISIBLE + 30; back >= 0; back--) {
    const k = (((K - back) % PERIOD) + PERIOD) % PERIOD;
    const x = xRight - (back + p) * pitch;
    if (x < -pitch * 40) continue;
    const g = trend(x / chartW);
    const b = BASE[k];
    if (back === 0) {
      const seen = b.path.slice(0, j + 1);
      const c = seen[seen.length - 1];
      const wick = j / LIFE;
      out.push({
        x,
        o: b.o + g,
        c: c + g,
        h: Math.max(...seen) + (b.h - Math.max(...b.path)) * wick + g,
        l: Math.min(...seen) - (Math.min(...b.path) - b.l) * wick + g,
        v: b.v * (0.15 + 0.85 * p),
        live: true,
      });
    } else out.push({ x, o: b.o + g, c: b.c + g, h: b.h + g, l: b.l + g, v: b.v, live: false });
  }
  return out;
};

const INSTR = ["US INDEX", "TECH INDEX", "EUR/USD", "CRUDE OIL", "GOLD", "BTC/USD", "USD INDEX", "GBP/USD"];
const INSTR_BASE = [5380.2, 18625.6, 1.0833, 81.44, 1582.3, 67290.5, 104.21, 1.2712];
const INSTR_DEC = [1, 1, 4, 2, 2, 1, 2, 4];
const WATCH = ["US INDEX", "TECH INDEX", "EUR/USD", "GBP/USD", "CRUDE OIL", "GOLD", "SILVER", "BTC/USD"];
const WATCH_BASE = [5380.2, 18625.6, 1.0833, 1.2712, 81.44, 1582.3, 29.41, 67290.5];
const WATCH_DEC = [1, 1, 4, 4, 2, 2, 2, 1];
const SUMMARY_NAMES = ["Indices", "Currencies", "Commodities", "Crypto"];

// 60-sample periodic series for the summary charts (scroll one full period per loop)
const SUM_SERIES = [0, 1, 2, 3].map((i) => {
  const r = mulberry32(900 + i);
  const a = Array.from({ length: 60 }, () => r());
  // smooth circularly
  return a.map((_, k) => (a[(k + 59) % 60] + 2 * a[k] + a[(k + 1) % 60]) / 4);
});

const fmt = (v: number, d: number) => v.toFixed(d);

export const drawTradingTerminal: DrawFn<TradingTerminalProps> = (ctx, w, h, frame, c) => {
  const f = loopFrame(frame);
  const R = Math.round;
  const X = (v: number) => R(v * w);
  const Y = (v: number) => R(v * h);
  const tiny = Math.max(7, R(0.0118 * h));
  const small = Math.max(8, R(0.0145 * h));
  const text = (s: string, x: number, y: number, color: string, size = tiny, font = SANS, weight = 400, align: CanvasTextAlign = "left") => {
    ctx.font = `${weight} ${size}px ${font}`;
    ctx.fillStyle = color;
    ctx.textAlign = align;
    ctx.fillText(s, X(x), Y(y));
  };
  ctx.textBaseline = "alphabetic";
  ctx.fillStyle = c.bg;
  ctx.fillRect(0, 0, w, h);

  // ------------------------------------------------------------ geometry --
  const chartL = 0;
  const chartR = 0.79;
  const chartT = 0.07;
  const chartB = 0.935;
  const chartW = (chartR - chartL) * w;
  const pitch = chartW / VISIBLE;
  const xRight = chartW - pitch * 0.9;
  const pTop = 1590;
  const pBot = 1546;
  const py = (p: number) => (chartT + ((pTop - p) / (pTop - pBot)) * (chartB - chartT)) * h;

  // grid
  ctx.fillStyle = c.grid;
  for (let gx = 0.0355; gx < 0.83; gx += 0.0355) ctx.fillRect(X(gx), Y(chartT), 1, Y(chartB - chartT));
  for (let p = 1548; p <= 1588; p += 2) ctx.fillRect(0, R(py(p)), X(0.83), 1);

  // faint floating chart notes, as in the reference
  [
    [0.18, 0.18, "1620.479"],
    [0.47, 0.37, "1621.469"],
    [0.31, 0.58, "1520.479"],
    [0.62, 0.71, "1621.480"],
  ].forEach(([x, y, s]) => text(s as string, x as number, y as number, c.grid === "#1E2838" ? "#3A4658" : c.grid, small, SANS, 400));

  // ------------------------------------------------------------- candles --
  const cs = candlesAt(f, chartW, pitch, xRight);
  ctx.save();
  ctx.beginPath();
  ctx.rect(0, Y(chartT), X(chartR), Y(chartB - chartT));
  ctx.clip();
  // volume bars
  const volB = chartB * h;
  const volH = 0.26 * h;
  cs.forEach((k) => {
    ctx.fillStyle = k.c >= k.o ? c.up : c.down;
    ctx.globalAlpha = 0.55;
    const vh = k.v * volH;
    ctx.fillRect(k.x - pitch * 0.32, volB - vh, pitch * 0.64, vh);
  });
  ctx.globalAlpha = 1;
  // moving averages (over the plotted values)
  const ma = (n: number, color: string, lwid: number) => {
    ctx.beginPath();
    let started = false;
    for (let i = n - 1; i < cs.length; i++) {
      let s = 0;
      for (let j = i - n + 1; j <= i; j++) s += cs[j].c;
      const yy = py(s / n);
      if (!started) ctx.moveTo(cs[i].x, yy);
      else ctx.lineTo(cs[i].x, yy);
      started = true;
    }
    ctx.strokeStyle = color;
    ctx.lineWidth = lwid;
    ctx.stroke();
  };
  ma(26, c.ma2, Math.max(1, 0.0012 * h));
  ma(9, c.ma1, Math.max(1, 0.0012 * h));
  // wicks + bodies
  const bodyW = pitch * 0.62;
  const wickW = Math.max(1, pitch * 0.12);
  cs.forEach((k) => {
    const up = k.c >= k.o;
    ctx.fillStyle = up ? c.up : c.down;
    ctx.fillRect(k.x - wickW / 2, py(k.h), wickW, py(k.l) - py(k.h));
    const top = py(Math.max(k.o, k.c));
    const bh = Math.max(1, py(Math.min(k.o, k.c)) - top);
    ctx.fillRect(k.x - bodyW / 2, top, bodyW, bh);
  });
  ctx.restore();

  // last-price line + tag
  const last = cs[cs.length - 1];
  const lastUp = last.c >= last.o;
  const ly = R(py(last.c));
  ctx.strokeStyle = lastUp ? c.up : c.down;
  ctx.lineWidth = 1;
  ctx.setLineDash([R(0.006 * h), R(0.005 * h)]);
  ctx.beginPath();
  ctx.moveTo(0, ly + 0.5);
  ctx.lineTo(X(chartR), ly + 0.5);
  ctx.stroke();
  ctx.setLineDash([]);

  // price scale
  ctx.fillStyle = c.bg;
  ctx.fillRect(X(chartR), Y(chartT), X(0.835) - X(chartR), Y(chartB - chartT));
  ctx.fillStyle = c.grid;
  ctx.fillRect(X(chartR), Y(chartT), 1, Y(chartB - chartT));
  for (let p = 1550; p <= 1588; p += 2) text(p.toFixed(2), 0.797, py(p) / h + 0.004, c.text, tiny, MONO, 400);
  const tagH = R(0.022 * h);
  ctx.fillStyle = lastUp ? c.up : c.down;
  ctx.fillRect(X(chartR) + 1, ly - R(tagH / 2), X(0.832) - X(chartR), tagH);
  text(last.c.toFixed(2), 0.797, (ly + tagH * 0.3) / h, c.bright, tiny, MONO, 500);

  // ---------------------------------------------------------- ticker bar --
  ctx.fillStyle = c.panel;
  ctx.fillRect(0, 0, X(0.833), Y(0.058));
  INSTR.forEach((name, i) => {
    const x0 = 0.004 + i * 0.1035;
    const hb = holdBucket(f, [20, 30, 24, 40, 20, 12, 60, 30][i], (i * 7) % 12);
    const jit = (hashF(i, hb, 5) - 0.5) * 0.002;
    const pct = ((hash3(i, 9) % 300) / 100 - 1.0) + jit * 50;
    const up = pct >= 0;
    const val = name === "GOLD" ? last.c : INSTR_BASE[i] * (1 + jit);
    const fresh = f % [20, 30, 24, 40, 20, 12, 60, 30][i] < 3; // brief flash on tick
    text(`${name} ▾`, x0, 0.02, c.bright, tiny, SANS, 600);
    text(fmt(val, INSTR_DEC[i]), x0 + 0.098, 0.02, fresh ? c.bright : c.text, tiny, MONO, 400, "right");
    text(`${up ? "▲" : "▼"} ${Math.abs(pct).toFixed(2)}%`, x0, 0.046, up ? c.up : c.down, small, SANS, 500);
    text(fmt(Math.abs(val * pct) / 100, INSTR_DEC[i]), x0 + 0.098, 0.046, c.text, tiny, MONO, 400, "right");
    ctx.fillStyle = c.grid;
    ctx.fillRect(X(x0 + 0.1005), Y(0.006), 1, Y(0.046));
  });
  ctx.fillStyle = c.grid;
  ctx.fillRect(0, Y(0.058), X(0.833), 1);

  // -------------------------------------------------------- bottom strip --
  ctx.fillStyle = c.panel;
  ctx.fillRect(0, Y(0.94), X(0.833), h - Y(0.94));
  for (let i = 0; i < 10; i++) {
    const x0 = 0.006 + i * 0.024;
    for (let r = 0; r < 2; r++) {
      ctx.fillStyle = (i + r) % 3 === 0 ? "#4A5668" : "#2A3446";
      ctx.fillRect(X(x0), Y(0.948 + r * 0.022), X(0.02), Y(0.012));
    }
  }
  for (let i = 0; i < 4; i++) {
    const x0 = 0.26 + i * 0.065;
    text(`${["ORDERS", "FILLS", "ALERTS", "LOG"][i]}  ${String(hash3(i, holdBucket(f, 30, i)) % 900 + 100)}`, x0, 0.958, c.text, tiny, MONO, 400);
    text(`${(hash3(i, 3, holdBucket(f, 20, i * 2)) % 10000) / 100}`, x0, 0.98, c.grid === "#1E2838" ? "#5A6678" : c.text, tiny, MONO, 400);
  }
  for (let i = 0; i < 24; i++) {
    const x0 = X(0.53 + i * 0.012);
    const v = (hash3(i, holdBucket(f, 10, i % 10), 4) % 100) / 100;
    ctx.fillStyle = i % 4 === 0 ? c.text : "#3A4658";
    ctx.fillRect(x0, Y(0.99) - R(v * 0.035 * h), Math.max(1, R(0.002 * h)), R(v * 0.035 * h));
  }

  // ---------------------------------------------------------- side panel --
  const sx = 0.836;
  ctx.fillStyle = c.panel;
  ctx.fillRect(X(sx), 0, w - X(sx), h);
  ctx.fillStyle = c.grid;
  ctx.fillRect(X(sx), 0, 1, h);
  text("Volume Watchlist", sx + 0.006, 0.03, c.bright, R(0.021 * h), SANS, 500);
  const cols = [sx + 0.006, sx + 0.088, sx + 0.122, sx + 0.158];
  ["Symbol", "Last", "Chg", "Chg%"].forEach((s, i) => text(s, cols[i], 0.052, c.text, tiny, SANS, 500, i ? "right" : "left"));
  WATCH.forEach((name, r) => {
    const yy = 0.072 + r * 0.0158;
    const hb = holdBucket(f, [24, 30, 20, 40, 15, 20, 60, 12][r], r * 3 % 12);
    const ch = ((hash3(r, 21) % 400) / 100 - 1.6) + (hashF(r, hb, 22) - 0.5) * 0.08;
    const up = ch >= 0;
    const last2 = name === "GOLD" ? last.c : WATCH_BASE[r] * (1 + ch / 100);
    text(name, cols[0], yy, c.bright, tiny, SANS, 500);
    text(fmt(last2, WATCH_DEC[r]), cols[1], yy, c.text, tiny, MONO, 400, "right");
    text(fmt((last2 * ch) / 100, WATCH_DEC[r]), cols[2], yy, up ? c.up : c.down, tiny, MONO, 400, "right");
    text(`${ch.toFixed(2)}%`, cols[3], yy, up ? c.up : c.down, tiny, MONO, 400, "right");
  });
  ctx.fillStyle = c.grid;
  ctx.fillRect(X(sx), Y(0.2), w - X(sx), 1);

  text("GOLD / USD", sx + 0.006, 0.228, c.bright, R(0.019 * h), SANS, 500);
  text(last.c.toFixed(2), sx + 0.006, 0.272, c.bright, R(0.038 * h), SANS, 500);
  ctx.fillStyle = c.up;
  ctx.fillRect(X(sx + 0.006), Y(0.284), X(0.036), Y(0.02));
  ctx.fillStyle = c.down;
  ctx.fillRect(X(sx + 0.046), Y(0.284), X(0.036), Y(0.02));
  text((last.c - 0.3).toFixed(2), sx + 0.024, 0.299, c.bright, tiny, MONO, 500, "center");
  text((last.c + 0.3).toFixed(2), sx + 0.064, 0.299, c.bright, tiny, MONO, 500, "center");
  for (let r = 0; r < 5; r++) {
    const yy = 0.245 + r * 0.013;
    text(["Open", "High", "Low", "Vol", "Spread"][r], sx + 0.092, yy, c.text, tiny, SANS, 400);
    const v = r === 3 ? String(12000 + (hash3(r, holdBucket(f, 20)) % 4000)) : r === 4 ? "0.60" : (last.c + [-1.2, 3.4, -4.1][r]).toFixed(2);
    text(v, sx + 0.158, yy, c.bright, tiny, MONO, 400, "right");
  }
  ctx.fillStyle = c.grid;
  ctx.fillRect(X(sx), Y(0.322), w - X(sx), 1);

  // four market summary mini area charts (2 × 2)
  const shift = cyc(f, 1) * 60; // one full series period per loop
  for (let i = 0; i < 4; i++) {
    const col = i % 2;
    const row = Math.floor(i / 2);
    const x0 = sx + 0.006 + col * 0.081;
    const y0 = 0.338 + row * 0.19;
    const cw = 0.075;
    const ch = 0.07;
    text("Market Summary", x0, y0 + 0.006, c.bright, tiny, SANS, 500);
    text(SUMMARY_NAMES[i], x0, y0 + 0.021, c.text, tiny, SANS, 400);
    const base = (y0 + 0.03 + ch) * h;
    ctx.beginPath();
    ctx.moveTo(X(x0), base);
    const N = 40;
    for (let s = 0; s <= N; s++) {
      const t = s + shift;
      const i0 = Math.floor(t) % 60;
      const fr = t - Math.floor(t);
      const v = SUM_SERIES[i][i0] * (1 - fr) + SUM_SERIES[i][(i0 + 1) % 60] * fr;
      const uu = s / N;
      const yy = base - (0.25 + 0.75 * (0.45 * v + 0.55 * uu * 0.6 + 0.2)) * ch * h * 0.9;
      ctx.lineTo(X(x0 + uu * cw), yy);
    }
    ctx.lineTo(X(x0 + cw), base);
    ctx.closePath();
    ctx.fillStyle = c.summary[i];
    ctx.globalAlpha = 0.75;
    ctx.fill();
    ctx.globalAlpha = 1;
    // small table under the chart
    for (let r = 0; r < 4; r++) {
      const yy = base / h + 0.018 + r * 0.0145;
      ctx.fillStyle = c.summary[(i + r) % 4];
      ctx.fillRect(X(x0), Y(yy - 0.008), Y(0.008), Y(0.008));
      text(INSTR[(i * 2 + r) % 8].split(" ")[0], x0 + 0.008, yy, c.text, tiny, SANS, 400);
      const ch2 = (hash3(i, r, holdBucket(f, 30, (i * 4 + r) % 30)) % 500) / 100 - 2.2;
      text(`${ch2.toFixed(2)}%`, x0 + cw, yy, ch2 >= 0 ? c.up : c.down, tiny, MONO, 400, "right");
    }
  }

  // data analysis
  ctx.fillStyle = c.grid;
  ctx.fillRect(X(sx), Y(0.712), w - X(sx), 1);
  text("Data Analysis", sx + 0.006, 0.735, c.bright, R(0.017 * h), SANS, 500);
  text(`(${String(hash3(7, holdBucket(f, 60)) % 90 + 10)})`, sx + 0.075, 0.735, c.text, tiny, SANS, 400);
  for (let i = 0; i < 30; i++) {
    const v = 0.2 + 0.8 * ((hash3(i, 31, holdBucket(f, 20, i % 20)) % 1000) / 1000);
    ctx.fillStyle = c.analysis;
    ctx.globalAlpha = 0.8;
    const bx = X(sx + 0.006 + i * 0.0052);
    ctx.fillRect(bx, Y(0.81) - R(v * 0.055 * h), Math.max(1, X(0.0034)), R(v * 0.055 * h));
  }
  ctx.globalAlpha = 1;
  for (let r = 0; r < 6; r++) {
    const yy = 0.835 + r * 0.0148;
    text(["Trend strength", "Volatility", "Momentum", "Open interest", "Breadth", "Sentiment"][r], sx + 0.006, yy, c.text, tiny, SANS, 400);
    const v = (hash3(r, 41, holdBucket(f, 40, r * 5)) % 10000) / 100;
    text(v.toFixed(2), sx + 0.158, yy, r % 3 === 1 ? c.down : c.bright, tiny, MONO, 400, "right");
  }
  text("HEADLINE FEED", sx + 0.006, 0.935, c.bright, tiny, SANS, 600);
  for (let r = 0; r < 3; r++) {
    ctx.fillStyle = "#3A4658";
    ctx.fillRect(X(sx + 0.006), Y(0.948 + r * 0.013), X(0.06 + ((r * 37) % 9) * 0.009), Math.max(1, Y(0.004)));
  }
  ctx.textAlign = "left";
};
