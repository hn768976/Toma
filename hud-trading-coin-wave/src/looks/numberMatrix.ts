import { DrawFn } from "../lib/CanvasLook";
import { MONO } from "../lib/fonts";
import { digits, hash3, hashF, holdBucket, HOLDS_8_40, loopFrame, mulberry32 } from "../lib/random";

export type NumberMatrixProps = {
  idx: string; // muted index column
  str: string; // bright long string
  val: string; // value column
  hi: string; // highlight bar fill
  line: string; // box / separator lines
  flash: string; // flashed / highlighted text
};

// ---------------------------------------------------------------- layout --
// All positions are fractions of the frame (x of width, y of height).
const PITCH = 0.0235; // row pitch
const FONT = 0.0146; // font size (cap height ≈ 1.1% of frame height)
const TRACK = 0.0026; // letter spacing
const GAP = 0.9; // gap between groups, in rows

// Each row: index (2) · short value (5) · long string (15) · value (5)
type PanelDef = { x: number; y: number; w: number; groups: number[]; boxed: boolean; cols: [number, number, number, number]; scale?: number };
const PANELS: PanelDef[] = [
  { x: 0.0156, y: 0.046, w: 0.272, groups: [6, 1, 6, 2, 6], boxed: false, cols: [0, 0.026, 0.09, 0.236] },
  { x: 0.393, y: 0.1, w: 0.19, groups: [6, 1, 6, 2, 4], boxed: true, cols: [0, 0.019, 0.063, 0.161], scale: 0.84 },
  { x: 0.703, y: 0.1, w: 0.19, groups: [6, 1, 6, 2, 4], boxed: true, cols: [0, 0.019, 0.063, 0.161], scale: 0.84 },
  { x: 0.0156, y: 0.746, w: 0.272, groups: [6, 2], boxed: false, cols: [0, 0.026, 0.09, 0.236] },
  { x: 0.34, y: 0.746, w: 0.262, groups: [6, 2], boxed: false, cols: [0, 0.024, 0.1, 0.232] },
  { x: 0.64, y: 0.746, w: 0.3, groups: [6, 2], boxed: false, cols: [0, 0.024, 0.07, 0.3] },
];

// ------------------------------------------------- seeded per-cell schedules --
type Row = {
  id: number;
  panel: number;
  group: number;
  r: number; // row within group
  y: number; // top, fraction of H
  index: string;
  holds: number[]; // per digit of the long string; 0 = never changes
  offs: number[];
  valHold: number;
  valOff: number;
  val2Hold: number;
  val2Off: number;
  dim: number; // 0.72..1 brightness
  shortStr: boolean;
};
type Group = { panel: number; rows: Row[]; y0: number; y1: number; wavePeriod: number; waveOff: number; hiPeriod: number; hiOff: number; hasHi: boolean };

const rnd = mulberry32(0x31292494);
const ROWS: Row[] = [];
const GROUPS: Group[] = [];
const WAVE_PERIODS = [100, 120, 150, 200, 300];
const HI_PERIODS = [60, 100, 120, 150];
// Groups that carry a stepping highlight bar (panel, group).
const HI_GROUPS = new Set(["0:0", "1:2", "5:0"]);

PANELS.forEach((p, pi) => {
  let y = p.y;
  const PITCH_P = PITCH * (p.scale ?? 1);
  p.groups.forEach((n, gi) => {
    const g: Group = {
      panel: pi,
      rows: [],
      y0: y,
      y1: y + n * PITCH_P,
      wavePeriod: WAVE_PERIODS[Math.floor(rnd() * WAVE_PERIODS.length)],
      waveOff: Math.floor(rnd() * 600),
      hiPeriod: 0,
      hiOff: Math.floor(rnd() * 600),
      hasHi: HI_GROUPS.has(`${pi}:${gi}`),
    };
    if (g.hasHi) g.hiPeriod = HI_PERIODS.filter((P) => P >= n * 6 + 12)[Math.floor(rnd() * 2)];
    for (let r = 0; r < n; r++) {
      const holds: number[] = [];
      const offs: number[] = [];
      for (let i = 0; i < 15; i++) {
        const h = rnd() < 0.22 ? 0 : HOLDS_8_40[Math.floor(rnd() * HOLDS_8_40.length)];
        holds.push(h);
        offs.push(h ? Math.floor(rnd() * h) : 0);
      }
      const valHold = HOLDS_8_40[Math.floor(rnd() * HOLDS_8_40.length)];
      const val2Hold = rnd() < 0.5 ? 0 : HOLDS_8_40[Math.floor(rnd() * HOLDS_8_40.length)];
      const row: Row = {
        id: ROWS.length,
        panel: pi,
        group: GROUPS.length,
        r,
        y,
        index: String(10 + Math.floor(rnd() * 90)),
        holds,
        offs,
        valHold,
        valOff: Math.floor(rnd() * valHold),
        val2Hold,
        val2Off: val2Hold ? Math.floor(rnd() * val2Hold) : 0,
        dim: 0.82 + rnd() * 0.18,
        shortStr: false,
      };
      ROWS.push(row);
      g.rows.push(row);
      y += PITCH_P;
    }
    GROUPS.push(g);
    y += GAP * PITCH_P;
  });
});

// Whole-block fade events (frame start, length) — none crosses the loop point.
const FADES = [
  { panel: 1, start: 120, len: 64 },
  { panel: 3, start: 292, len: 52 },
  { panel: 5, start: 452, len: 72 },
];
const GLITCH_FRAMES = [87, 233, 391, 512];

const blockAlpha = (panel: number, f: number) => {
  let a = 1;
  for (const e of FADES) {
    if (e.panel !== panel) continue;
    const t = f - e.start;
    if (t < 0 || t > e.len) continue;
    const ramp = 8;
    const out = Math.min(1, t / ramp);
    const back = Math.min(1, (e.len - t) / ramp);
    // short flicker while fading out
    const flick = t < ramp && hash3(panel, t, 7) % 3 === 0 ? 0.5 : 1;
    a = Math.min(a, Math.max(0, 1 - Math.min(out, back)) * flick);
  }
  return a;
};

const longString = (row: Row, f: number, wave: boolean, waveBucket: number) => {
  let s = "";
  for (let i = 0; i < 15; i++) {
    const h = row.holds[i];
    if (wave) s += String(hash3(row.id, i + 100, waveBucket) % 10);
    else if (h === 0) s += String(hash3(row.id, i) % 10);
    else s += String(hash3(row.id, i, holdBucket(f, h, row.offs[i])) % 10);
  }
  return s;
};

export const drawNumberMatrix: DrawFn<NumberMatrixProps> = (ctx, w, h, frame, c) => {
  const f = loopFrame(frame);
  ctx.fillStyle = "#000";
  ctx.fillRect(0, 0, w, h);

  const px = (v: number) => Math.round(v * w);
  const py = (v: number) => Math.round(v * h);
  const fontPx = Math.max(8, Math.round(FONT * h));
  ctx.font = `400 ${fontPx}px ${MONO}`;
  ctx.textBaseline = "alphabetic";
  const track = Math.round(TRACK * h * 10) / 10;
  ctx.letterSpacing = `${track}px`;
  const rowH = PITCH * h;
  const lineW = Math.max(1, Math.round(h / 1440));
  const glitch = GLITCH_FRAMES.indexOf(f);

  PANELS.forEach((p, pi) => {
    const alpha = blockAlpha(pi, f);
    if (alpha <= 0) return;
    ctx.globalAlpha = alpha;
    const gx = glitch >= 0 ? (hash3(pi, glitch, 3) % 3) - 1 : 0;
    const shift = gx * Math.max(1, Math.round(h / 1440));
    const X = (v: number) => px(p.x + v) + shift;
    const sc = p.scale ?? 1;
    const fpx = Math.max(7, Math.round(FONT * h * sc));
    ctx.letterSpacing = `${Math.round(TRACK * h * sc * 10) / 10}px`;
    const rowHP = rowH * sc;

    // group boxes / separators
    ctx.strokeStyle = c.line;
    ctx.lineWidth = lineW;
    GROUPS.filter((g) => g.panel === pi).forEach((g) => {
      const top = py(g.y0 - 0.3 * PITCH * sc) + 0.5 * (lineW % 2);
      const bot = py(g.y1 + 0.15 * PITCH * sc) + 0.5 * (lineW % 2);
      const left = X(-0.006) + 0.5 * (lineW % 2);
      const right = X(p.w) + 0.5 * (lineW % 2);
      ctx.beginPath();
      if (!p.boxed) return;
      ctx.rect(left, top, right - left, bot - top);
      // double left edge and inner column dividers, as in the reference
      ctx.moveTo(left + 2 * lineW, top);
      ctx.lineTo(left + 2 * lineW, bot);
      for (const cx of [p.cols[2] - 0.004, p.cols[3] - 0.004]) {
        ctx.moveTo(X(cx) + 0.5 * (lineW % 2), top);
        ctx.lineTo(X(cx) + 0.5 * (lineW % 2), bot);
      }
      ctx.stroke();
    });

    GROUPS.filter((g) => g.panel === pi).forEach((g) => {
      // stepping highlight bar
      let hiRow = -1;
      if (g.hasHi) {
        const t = (f + g.hiOff) % g.hiPeriod;
        if (t < g.rows.length * 6) hiRow = Math.floor(t / 6);
      }
      const wt = (f + g.waveOff) % g.wavePeriod;
      g.rows.forEach((row) => {
        ctx.font = `500 ${fpx}px ${MONO}`;
        const top = py(row.y);
        const base = top + Math.round(rowHP * 0.76);
        const dw = wt - row.r * 2; // wave reaches row r two frames after row r-1
        const wave = dw >= 0 && dw < 8;
        const waveBucket = Math.floor(f / 2) + row.r * 1000;
        const flashB = Math.floor(f / 50);
        const flash = (hashF(row.id, flashB, 11) < 0.07 && f % 50 < 5) || wave;
        const isHi = row.r === hiRow;
        if (isHi) {
          ctx.fillStyle = c.hi;
          ctx.fillRect(X(-0.004), top, X(p.w) - X(-0.004), Math.round(rowHP * 0.94));
        }
        const dim = isHi || flash ? 1 : row.dim;
        ctx.globalAlpha = alpha * dim;
        const valStr = digits(5, row.id, 77, holdBucket(f, row.valHold, row.valOff));
        ctx.fillStyle = isHi || flash ? c.flash : c.val;
        ctx.font = `600 ${fpx}px ${MONO}`;
        ctx.fillText(row.index, X(p.cols[0]), base);
        ctx.font = `500 ${fpx}px ${MONO}`;
        if (!row.shortStr) {
          ctx.fillStyle = isHi || flash ? c.flash : c.str;
          ctx.fillText(longString(row, f, wave, waveBucket), X(p.cols[2]), base);
        }
        const val2 = row.val2Hold ? digits(5, row.id, 78, holdBucket(f, row.val2Hold, row.val2Off)) : digits(5, row.id, 78);
        ctx.fillStyle = isHi || flash ? c.flash : c.idx;
        ctx.fillText(val2, X(p.cols[1]), base);
        ctx.fillText(valStr, X(p.cols[3]), base);
        ctx.globalAlpha = alpha;
      });
    });
  });
  ctx.globalAlpha = 1;
  ctx.letterSpacing = "0px";
};
