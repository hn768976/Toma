import { Hud } from "../../lib/hud";
import { fillerLine, LOOP, LoopNoise, tick, tickTable, typedChars } from "../../lib/loop";
import { mulberry32 } from "../../lib/random";
import { easeInOutSine } from "../../lib/ease";

// Design space: the reference's own 898x506 pixel grid. Lines are 1 px at
// 720p whatever the output size (Hud.lw).
export const AI_W = 898;
export const AI_H = 506;

const TAU = Math.PI * 2;
const rng = mulberry32(0xa1c0de);

// ---------------------------------------------------------------- data
// Every table below is built once, at module load, from a fixed seed.

const LEFT_LETTERS = ["H9", "K2", "Q8", "L3", "E6", "B3", "K2"];
const LEFT_ROWS = 12;
const leftNumbers = Array.from({ length: LEFT_ROWS }, (_, row) => {
  const period = [20, 24, 25, 30, 40, 50, 60, 75][row % 8];
  const decimals = [4, 1, 0, 3, 0, 1, 2, 3, 4, 4, 0, 3][row];
  const base = 100 + rng() * 950;
  const table = tickTable(period, () => (base * (0.9 + rng() * 0.2)).toFixed(decimals));
  return { period, table, dim: row === 2 || row === 8 };
});

const CODE_LEFT = [
  "vx, node.y + dy",
  "  if 0 <= nx_k <",
  "node.mesh.w and 0 <=",
  "ny_k < node.mesh.h:",
  "  node.x, node.y = nx_k, ny_k",
  "  node.charge -= 1",
];

const CODE_MID = [
  "if (unit_map->cell[0] !=",
  "unit_map->root_cell) {",
  "",
  "    int k;",
  "",
  "    for (k = 0; k < unit_map->n",
  "",
  "        drop_cell((ulong)",
  "    unit_map->cell[k]);",
  "    }",
  "",
  "    release(unit_map);",
  "",
  "}",
  "",
  "",
  "SIGNAL(unit_release);",
  "",
  "",
  "/* map the unit table to a",
  "   shared ring buffer */",
  "",
  "static int units_to_ring(uid_q",
  "    struct unit_map *unit_map)",
  "{",
];

const CODE_RIGHT = [
  "vx, node.y = dy",
  "if 0 <= nx_k <",
  "node.mesh.w and 0 <=",
  "ny_k < node.mesh.h:",
  "node.x, node.y = nx_k, ny_k",
  "node.charge -= 1",
  "",
  "fn spawn_unit(node):",
  "if node.charge >= 200:",
  "sub_x, sub_y =",
  "node.x, node.y",
  "node.charge -= 100",
  "yield node.kind(",
  "(node.mesh, sub_x, sub_y)",
  "yield void",
];

const MID_NUMBERS = [
  { y: 151, period: 30 },
  { y: 169, period: 40 },
  { y: 175, period: 25 },
  { y: 213, period: 50 },
  { y: 245, period: 60 },
  { y: 275, period: 75 },
].map((r) => ({
  ...r,
  table: tickTable(r.period, () => `${Math.floor(300 + rng() * 1500)} ,${String(Math.floor(rng() * 9999)).padStart(4, "0")}`),
}));

const RIGHT_LETTERS = ["Q7", "Y5", "A7", "U1", "W3", "K9", "M8", "O5", "I9"];

const tinyPara1 = Array.from({ length: 5 }, () => fillerLine(rng, 58, true));
const tinyPara2 = Array.from({ length: 10 }, () => fillerLine(rng, 88));
const tinyDuration = Array.from({ length: 6 }, () => fillerLine(rng, 40));
const tinyArm = Array.from({ length: 3 }, () => fillerLine(rng, 110, true));
const tinyLoading = Array.from({ length: 9 }, () => fillerLine(rng, 44, true));
const tinyDisk = Array.from({ length: 9 }, () => fillerLine(rng, 40, true));
const tinySmallPanel = Array.from({ length: 4 }, () => fillerLine(rng, 24, true));

// Waveforms: periodic noise, scrolled by whole periods per loop.
const waveTop = new LoopNoise(rng, 240, 0);
const waveTopEnv = new LoopNoise(rng, 60, 2);
const waveStrips = [0, 1, 2].map(() => new LoopNoise(rng, 200, 0));
const waveStripEnv = [0, 1, 2].map(() => new LoopNoise(rng, 40, 1));
const waveSmooth = [0, 1, 2, 3].map(() => new LoopNoise(rng, 24, 2));

// Bar meters (8 columns, top right) and the small cluster (top left).
const meterPhase = Array.from({ length: 8 }, () => rng());
const meterPeriod = Array.from({ length: 8 }, () => [100, 120, 150, 200, 300][Math.floor(rng() * 5)]);
const clusterTable = tickTable(6, () => Array.from({ length: 11 }, () => 0.35 + rng() * 0.65));

// Readout boxes.
const readouts = [
  { x: 477, period: 20, dec: 1, base: 1005 },
  { x: 536, period: 30, dec: 1, base: 263 },
  { x: 669, period: 25, dec: 1, base: 983 },
  { x: 725, period: 50, dec: 0, base: 278 },
].map((r) => ({ ...r, table: tickTable(r.period, () => (r.base * (0.97 + rng() * 0.06)).toFixed(r.dec)) }));

// Line graph with dots (two series, 24 points each).
const graphPts = [0, 1].map(() =>
  Array.from({ length: 34 }, () => ({ base: rng() * 2 - 1, amp: 0.2 + rng() * 0.5, k: 1 + Math.floor(rng() * 3), ph: rng() })),
);

// Circuit traces around the AI badge: right-angle walks with end dots.
type Trace = { pts: number[]; len: number; period: number; phase: number };
const BADGE = { x: 259, y: 160 };
const circuit: Trace[] = (() => {
  // A dense maze of short right-angle traces filling a rounded blob around
  // and mostly below the badge (like a circuit brain), never crossing the ring.
  const out: Trace[] = [];
  const inBlob = (x: number, y: number) => {
    const dx = (x - 257) / 54;
    const dy = (y - 182) / (y < 182 ? 74 : 70);
    return dx * dx + dy * dy < 1 && Math.hypot(x - BADGE.x, y - BADGE.y) > 35;
  };
  let tries = 0;
  while (out.length < 120 && tries < 4000) {
    tries++;
    let x = 200 + rng() * 115;
    let y = 106 + rng() * 148;
    if (!inBlob(x, y)) continue;
    x = Math.round(x / 2.5) * 2.5;
    y = Math.round(y / 2.5) * 2.5;
    const pts = [x, y];
    let horizontal = rng() < 0.5;
    let dir = rng() < 0.5 ? -1 : 1;
    const segs = 2 + Math.floor(rng() * 4);
    for (let k = 0; k < segs; k++) {
      const len = 2.5 * (1 + Math.floor(rng() * 4));
      const nx = horizontal ? x + dir * len : x;
      const ny = horizontal ? y : y + dir * len;
      if (!inBlob(nx, ny)) break;
      x = nx;
      y = ny;
      pts.push(x, y);
      horizontal = !horizontal;
      if (rng() < 0.4) dir = -dir;
    }
    if (pts.length >= 4) {
      let len = 0;
      for (let p = 2; p < pts.length; p += 2) len += Math.hypot(pts[p] - pts[p - 2], pts[p + 1] - pts[p - 1]);
      out.push({ pts, len, period: [100, 120, 150, 200, 300][Math.floor(rng() * 5)], phase: rng() });
    }
  }
  return out;
})();

// 5x7 dot-matrix digits for the bottom-right display.
const DIGITS = [
  "01110100011001110101110011000101110",
  "00100011000010000100001000010001110",
  "01110100010000100010001000100011111",
  "11111000100010000010000011000101110",
  "00010001100101010010111110001000010",
  "11111100001111000001000011000101110",
  "00110010001000011110100011000101110",
  "11111000010001000100010000100001000",
  "01110100011000101110100011000101110",
  "01110100011000101111000010001001100",
];
const dotDigitsTable = tickTable(50, () => [Math.floor(rng() * 10), Math.floor(rng() * 10)]);

const unitCodeTable = tickTable(40, () => String(Math.floor(100 + rng() * 899)));
const bigNumTable = tickTable(30, () => [String(10 + Math.floor(rng() * 89)), String(10 + Math.floor(rng() * 89))]);

// ---------------------------------------------------------------- helpers

const pad2 = (n: number) => String(n).padStart(2, "0");

/** Clock-style readout that advances with the frame and wraps with the loop. */
const clock = (f: number, a: number, b: number) => {
  const cs = (f * 100) / 30; // hundredths of a second
  const s = Math.floor(cs / 100);
  return `${pad2((a + Math.floor((s + b) / 60)) % 100)}:${pad2((s + b) % 60)}:${pad2(Math.floor(cs) % 100)}`;
};

// ---------------------------------------------------------------- draw

export const drawAIHud = (ctx: CanvasRenderingContext2D, bw: number, _bh: number, frame: number, color = "#E8E8E8") => {
  const f = frame % LOOP;
  const h = new Hud(ctx, bw, AI_W, color);
  h.smallTextAlpha = 0.68;
  h.strokeAlpha = 0.78;
  const DIM = 0.55;

  // ===== top-left: port header, bar strip, system overview, meters, wave
  h.fill(27, 35.5, 2.4, 2.4);
  h.text("[OPEN PORT 62.09.26  ]", 31, 38.5, 4.3);
  h.text("PT • 21.400", 31, 43, 2.6, { alpha: DIM });
  // segmented strip with a block that slides (period 300)
  for (let i = 0; i < 12; i++) h.hline(33 + i * 14.8, 33 + i * 14.8 + 12.5, 48.5);
  h.hline(33, 208, 57.5);
  const blk = 33 + ((f % 300) / 300) * 150;
  h.fillSmooth(blk, 50.5, 26, 4.6, 0.85);
  h.fillSmooth(((blk - 33 + 34) % 150) + 33, 50.5, 26, 4.6, 0.35);
  h.fill(27, 63, 2.4, 2.4);
  h.text("[SYSTEM OVERVIEW]", 31, 66, 4.3);
  h.text("01.371 5904 5820", 31, 70.5, 2.6, { alpha: DIM });
  const cl = tick(clusterTable, 6, f);
  for (let i = 0; i < cl.length; i++) {
    const bh = 13 * cl[i];
    h.fill(225 + i * 4.1, 73.5 - bh, 3.0, bh, 0.8);
  }
  // dense waveform strip
  {
    const scroll = (f / LOOP) * 240 * 2;
    const pts: number[] = [];
    for (let x = 0; x <= 205; x += 0.5) {
      const env = 0.35 + 0.65 * Math.abs(waveTopEnv.at((x + scroll * 0.25) / 4));
      const v = waveTop.at(x * 1.3 + scroll) * env * 11;
      pts.push(33 + x, 96 - v);
    }
    h.poly(pts, 0.75);
    h.hline(33, 238, 96, 0.4);
  }

  // ===== left column: ticking letter/number pairs + meters
  for (let i = 0; i < LEFT_LETTERS.length; i++) {
    const y = i < 6 ? 128 + i * 22.2 : 259;
    h.text(LEFT_LETTERS[i], 48, y, 7.6, { font: "sans", weight: 400 });
  }
  for (let r = 0; r < LEFT_ROWS; r++) {
    const n = leftNumbers[r];
    const y = 127 + r * 20.2;
    h.text(tick(n.table, n.period, f), 77, y, 6.0, { font: "sans", alpha: n.dim ? 0.45 : 1 });
  }
  const meterL = (y0: number, y1: number, ph: number) => {
    h.rect(22, y0, 3, y1 - y0, 0.35);
    const lvl = 0.5 + 0.45 * Math.sin(TAU * (f / 200 + ph));
    h.fill(22, y1 - (y1 - y0) * lvl, 3, (y1 - y0) * lvl * 0.5, 0.85);
  };
  meterL(113, 128, 0.1);
  meterL(209, 238, 0.4);
  meterL(279, 353, 0.7);

  // LOADING DATA
  h.text("LOADING DATA", 117, 122, 7.6, { font: "sans", weight: 300 });
  const ld = 0.5 + 0.5 * Math.sin(TAU * (f / 150));
  h.fill(115, 129.5, 68, 1.6, 0.45);
  h.fill(115, 129.5, 68 * (0.25 + 0.75 * ld), 1.6, 0.9);
  h.fill(115, 134, 68, 1.2, 0.3);

  // code block typing in (period 300)
  {
    const total = CODE_LEFT.join("").length;
    let left = typedChars(total, f, 300, 0.02, 0.6);
    CODE_LEFT.forEach((line, i) => {
      const n = Math.max(0, Math.min(line.length, left));
      left -= line.length;
      if (n > 0) h.text(line.slice(0, n), 123, 175 + i * 14.4, 4.3, { weight: 400 });
    });
    h.text("fn spawn_unit(node):", 124, 276, 4.3);
  }

  // ===== AI badge + circuit brain
  {
    const { x, y } = BADGE;
    for (const t of circuit) {
      h.poly(t.pts, 0.5);
      const n = t.pts.length;
      h.circle(t.pts[n - 2], t.pts[n - 1], 0.8, 0.75);
      // a pulse running out along the trace
      const p = ((f / t.period + t.phase) % 1) * 1.6;
      if (p < 1) {
        let d = p * t.len;
        for (let s = 2; s < n; s += 2) {
          const sl = Math.hypot(t.pts[s] - t.pts[s - 2], t.pts[s + 1] - t.pts[s - 1]);
          if (d <= sl) {
            const u = d / sl;
            h.dot(t.pts[s - 2] + (t.pts[s] - t.pts[s - 2]) * u, t.pts[s - 1] + (t.pts[s + 1] - t.pts[s - 1]) * u, 0.9, 1);
            break;
          }
          d -= sl;
        }
      }
    }
    // black disc behind the badge so traces stop at the ring
    ctx.globalAlpha = 1;
    ctx.fillStyle = "#000";
    ctx.beginPath();
    ctx.arc(x, y, 31.5, 0, TAU);
    ctx.fill();
    ctx.fillStyle = h.color;
    // rotating outer tick ring (one turn per loop)
    const rot = (f / LOOP) * TAU;
    for (let i = 0; i < 72; i++) {
      const a = rot + (i / 72) * TAU;
      const long = i % 6 === 0;
      const r0 = 29.2;
      const r1 = long ? 31.6 : 30.6;
      h.line(x + Math.cos(a) * r0, y + Math.sin(a) * r0, x + Math.cos(a) * r1, y + Math.sin(a) * r1, long ? 0.9 : 0.5, false);
    }
    // counter-rotating dashed arcs
    for (let i = 0; i < 4; i++) {
      const a0 = -rot * 2 + (i / 4) * TAU;
      h.circle(x, y, 26, 0.9, 1, a0, a0 + TAU / 4 - 0.35);
    }
    h.circle(x, y, 22.5, 1, 2.2);
    h.circle(x, y, 19.5, 0.6);
    h.text("AI", x, y + 4.6, 13, { font: "sans", weight: 500, align: "center" });
  }

  // ===== centre column: clock row, numbers, code
  h.rect(302, 96.5, 5, 4, 0.9);
  h.rect(304, 95, 5, 4, 0.9);
  h.text(clock(f, 21, 18), 312, 103, 7.6, { font: "sans" });
  h.text("olrt.....593---s", 357, 102, 4.0, { alpha: 0.85 });
  h.text("BDM21", 402, 102, 4.0);
  h.text(String(3 + (Math.floor(f / 60) % 7)), 436, 102, 4.0);
  h.rect(328, 124, 30, 4, 0.9);
  for (let i = 0; i < 26; i++) h.vline(362 + i * 3.4, 122, 129, i % 5 === 0 ? 1 : 0.7);
  h.text("Loading Data" + ".".repeat(1 + (Math.floor(f / 10) % 6)), 322, 138, 3.6, { weight: 400 });
  for (const n of MID_NUMBERS) h.text(tick(n.table, n.period, f), 324, n.y, 4.0, { alpha: 0.95 });
  {
    const total = CODE_MID.join("").length;
    let left = typedChars(total, f, 300, 0.0, 0.45);
    CODE_MID.forEach((line, i) => {
      const n = Math.max(0, Math.min(line.length, left));
      left -= line.length;
      if (n > 0) h.text(line.slice(0, n), 365, 148 + i * 6.05, 3.6);
    });
  }

  // ===== top centre: log header + tiny paragraphs
  h.text("02 LOG - 54.7.32", 302, 18.5, 4.6, { font: "sans" });
  tinyPara1.forEach((l, i) => h.text(l, 302, 25 + i * 2.6, 1.9, { alpha: 0.75 }));
  tinyPara2.forEach((l, i) => h.text(l, 302, 45.5 + i * 2.25, 1.6, { alpha: 0.55 }));
  h.vline(446, 35, 62, 0.8);
  h.fill(445.3, 35 + ((f % 200) / 200) * 22, 1.4, 5, 0.9);

  // ===== top waveform with a moving spike
  {
    const y0 = 50;
    const spikeX = 458 + ((f % 300) / 300) * 251;
    for (let i = 0; i < 19; i++) {
      const x = 459 + i * 13.85;
      h.vline(x, 33, 61, 0.8);
      h.dot(x, 33, 0.9);
      h.dot(x, 61, 0.9);
    }
    const scroll = (f / LOOP) * 240 * 3;
    for (let x = 458; x <= 709; x += 0.9) {
      const env = Math.pow(Math.abs(Math.sin((x - 458) / 9 + (f / LOOP) * TAU * 3)), 2) * 5;
      const d = (x - spikeX) / 5;
      const spike = Math.exp(-d * d) * 26;
      const a = (env + spike) * (0.35 + 0.65 * Math.abs(waveTop.at(x * 2.1 + scroll)));
      h.line(x, y0 - a, x, y0 + a, 0.55 + 0.35 * Math.min(1, a / 12), false);
    }
    h.hline(458, 709, y0, 0.9);
  }

  // readout boxes
  {
    const r = readouts;
    h.fill(450, 71, 54, 10.5, 0.42);
    h.text(tick(r[0].table, r[0].period, f), r[0].x, 79, 6.0, { font: "sans", align: "center" });
    h.text(tick(r[1].table, r[1].period, f), r[1].x, 79, 6.0, { font: "sans", align: "center" });
    h.fill(578, 71, 54, 10.5, 0.42);
    h.text("■■■", 605, 79, 4.5, { align: "center", alpha: 0.35 });
    h.rect(642, 71, 54, 10.5);
    h.text(tick(r[2].table, r[2].period, f), r[2].x, 79, 6.0, { font: "sans", align: "center" });
    h.text(tick(r[3].table, r[3].period, f), r[3].x, 79, 6.0, { font: "sans", align: "center" });
  }

  // bar meters (8 columns of stacked segments)
  ["Y6", "", "T9", "", "W3", "07", "", ""].forEach((l, i) => l && h.text(l, 734 + i * 15.2, 25, 3.4, { alpha: 0.7 }));
  for (let i = 0; i < 8; i++) {
    const x = 731 + i * 15.2;
    h.rect(x, 30, 8.5, 33, 0.6);
    h.hline(x, x + 8.5, 31.8, 0.6);
    const lvl = 0.45 + 0.5 * (0.5 + 0.5 * Math.sin(TAU * (f / meterPeriod[i] + meterPhase[i])));
    const segs = Math.round(lvl * 12);
    for (let s = 0; s < segs; s++) h.fill(x + 1.6, 60.5 - s * 2.35, 5.3, 1.25, 0.62);
  }
  h.text("1432 / JH 21", 775, 81, 8.2, { font: "sans" });

  // far-right vertical gauge stack
  for (let i = 0; i < 3; i++) {
    const x = 857 + i * 6;
    const y0 = 78 + i * 12;
    const y1 = 320 - i * 20;
    h.vline(x, y0, y1, 0.3);
    for (let k = 0; k < 4; k++) {
      const p = 0.5 + 0.5 * Math.sin(TAU * (f / [150, 200, 300, 120][k] + i * 0.3 + k * 0.21));
      const yy = y0 + (y1 - y0) * ((k + p * 0.8) / 4.2);
      h.fill(x - 0.8, yy, 1.6, 8 + 10 * p, 0.45 + 0.4 * p);
    }
  }

  // row labels under the readouts
  h.text("A", 495, 101, 4.3);
  h.text("I", 538, 101, 4.3);
  h.text("1", 571, 101, 4.3);
  h.text(`624 78 9 ${pad2(Math.floor(f / 25) % 24)}`, 581, 101, 4.3);
  h.text("LINE", 622, 101, 4.3);
  h.fill(685, 96.5, 2, 2);
  h.text("[DATA_____8:12]", 688, 99, 3.6);
  h.text("2.701 5.13", 690, 103, 2.2, { alpha: DIM });
  h.text("DURATION NO 2167", 778, 101, 4.3, { font: "sans", alpha: 0.6 });
  tinyDuration.forEach((l, i) => h.text(l, 778, 107 + i * 2.3, 1.6, { alpha: 0.6 }));

  // right code column (right aligned), typing (period 600, offset)
  {
    const total = CODE_RIGHT.join("").length;
    let left = typedChars(total, (f + 300) % LOOP, 600, 0.02, 0.7);
    CODE_RIGHT.forEach((line, i) => {
      const n = Math.max(0, Math.min(line.length, left));
      left -= line.length;
      if (n > 0) h.text(line.slice(0, n), 847, 136 + i * 14.3, 4.3, { align: "right" });
    });
  }
  RIGHT_LETTERS.forEach((l, i) => h.text(l, 871, 331 + i * 15.1, 5.4, { font: "sans", weight: i === 5 ? 500 : 300 }));

  // ===== robot-arm panel
  {
    // corner brackets + top rule
    h.poly([465, 143, 465, 122, 486, 122], 1, false, true);
    h.poly([690, 122, 710, 122, 710, 143], 1, false, true);
    h.poly([465, 232, 465, 253], 1, false, true);
    h.poly([710, 232, 710, 253], 1, false, true);
    h.hline(490, 615, 123.5, 0.9);
    // faint dashed grid behind the arm
    for (let gx = 480; gx <= 700; gx += 20) for (let gy = 130; gy < 240; gy += 4) h.vline(gx, gy, gy + 1.5, 0.14);
    for (let gy = 140; gy <= 230; gy += 18) for (let gx = 470; gx < 705; gx += 4) h.hline(gx, gx + 1.5, gy, 0.14);
    // crosshair and readout
    for (let y = 126; y < 206; y += 3) h.vline(557, y, y + 1.6, 0.7);
    h.hline(507, 590, 173, 0.9);
    h.text("Y00", 518, 163.5, 2.4, { alpha: DIM });
    h.text((14900 + (Math.floor(f / 20) % 30) * 3.25).toFixed(2), 518, 170.5, 4.6, { font: "sans" });
    h.circle(557, 173, 2.8, 0.9);
    // diamond marker
    h.poly([603, 194, 606, 198, 603, 202, 600, 198], 0.9, true);
    h.hline(591, 615, 198, 0.6);

    // arm pose: two poses, eased, period 300 (two cycles per loop)
    const k = easeInOutSine(0.5 - 0.5 * Math.cos(TAU * (f / 300)));
    const a1 = (-122 + 14 * k) * (Math.PI / 180); // upper arm, from shoulder
    const a2 = (148 - 26 * k) * (Math.PI / 180); // forearm, absolute
    const a3 = (102 - 12 * k) * (Math.PI / 180); // wrist/gripper
    const sx = 641;
    const sy = 202;
    const ex = sx + Math.cos(a1) * 54;
    const ey = sy + Math.sin(a1) * 54;
    const wx = ex + Math.cos(a2) * 46;
    const wy = ey + Math.sin(a2) * 46;
    const gx = wx + Math.cos(a3) * 11;
    const gy = wy + Math.sin(a3) * 11;
    const capsule = (x1: number, y1: number, x2: number, y2: number, w: number) => {
      const dx = x2 - x1;
      const dy = y2 - y1;
      const l = Math.hypot(dx, dy);
      const nx = (-dy / l) * w;
      const ny = (dx / l) * w;
      // grey body shading
      ctx.globalAlpha = 0.22;
      ctx.beginPath();
      ctx.moveTo(x1 + nx, y1 + ny);
      ctx.lineTo(x2 + nx, y2 + ny);
      ctx.lineTo(x2 - nx, y2 - ny);
      ctx.lineTo(x1 - nx, y1 - ny);
      ctx.closePath();
      ctx.fill();
      ctx.globalAlpha = 1;
      for (let u = 0.2; u < 0.9; u += 0.17) {
        const cx = x1 + dx * u;
        const cy = y1 + dy * u;
        h.line(cx + nx * 0.8, cy + ny * 0.8, cx - nx * 0.8, cy - ny * 0.8, 0.35, false);
      }
      h.line(x1 + nx, y1 + ny, x2 + nx, y2 + ny, 0.95, false);
      h.line(x1 - nx, y1 - ny, x2 - nx, y2 - ny, 0.95, false);
      h.line(x1 + nx * 0.35, y1 + ny * 0.35, x2 + nx * 0.35, y2 + ny * 0.35, 0.4, false);
    };
    // base, pedestal and a cable
    h.fill(631, 199, 20, 17, 0.18);
    h.rect(631, 199, 20, 17);
    h.fill(627, 216, 26, 9, 0.3);
    h.rect(627, 216, 26, 9);
    for (let i = 0; i < 4; i++) h.hline(633, 649, 203 + i * 3.5, 0.4);
    h.poly([651, 210, 660, 212, 664, 220, 668, 225], 0.7);
    h.hline(612, 668, 225.5, 0.8);
    capsule(sx, sy, ex, ey, 5.2);
    capsule(ex, ey, wx, wy, 4.2);
    capsule(wx, wy, gx, gy, 2.6);
    h.circle(sx, sy, 6.5, 0.95);
    h.circle(ex, ey, 7.5, 0.95);
    h.circle(ex, ey, 3, 0.6);
    h.circle(wx, wy, 4.8, 0.95);
    // gripper jaws
    const ja = a3 + Math.PI / 2;
    h.line(gx + Math.cos(ja) * 3, gy + Math.sin(ja) * 3, gx + Math.cos(ja) * 3 + Math.cos(a3) * 5, gy + Math.sin(ja) * 3 + Math.sin(a3) * 5, 0.95, false);
    h.line(gx - Math.cos(ja) * 3, gy - Math.sin(ja) * 3, gx - Math.cos(ja) * 3 + Math.cos(a3) * 5, gy - Math.sin(ja) * 3 + Math.sin(a3) * 5, 0.95, false);
    // label near the elbow
    h.text("T19", ex - 22, ey + 22, 3.2, { alpha: 0.85 });
    // scan fan from the tip, sweeping
    const tipX = gx + Math.cos(a3) * 5;
    const tipY = gy + Math.sin(a3) * 5;
    const sweep = 0.5 + 0.5 * Math.sin(TAU * (f / 120));
    for (let i = 0; i < 9; i++) {
      const tx = 498 + i * 7.5 + sweep * 10;
      const ty = 226 - Math.abs(i - 4) * 1.2;
      h.line(tipX, tipY, tx, ty, 0.35 + (i % 3 === 0 ? 0.35 : 0), false);
    }
    h.poly([498 + sweep * 10, 226, 560 + sweep * 10, 230, 590, 230], 0.6);
    // slider bar at the panel bottom
    h.rect(580, 226, 86, 5, 0.7);
    h.fill(582, 227.5, 8 + 20 * k, 2, 0.9);
    // tiny dense text and the AI bar
    tinyArm.forEach((l, i) => h.text(l, 497, 249 + i * 3, 2.3, { alpha: 0.9 }));
    h.rect(476, 265, 220, 12);
    for (let i = 0; i < 6; i++) {
      h.hline(486 + i * 5, 489 + i * 5, 271, 0.8);
      h.hline(654 + i * 5, 657 + i * 5, 271, 0.8);
    }
    h.text("ARTIFICIAL INTELLIGENCE", 586, 273, 5.0, { font: "sans", align: "center" });
    h.hline(497, 676, 287.5, 0.9);
    [498, 551, 594, 641].forEach((x, i) =>
      h.text(`0.${String(Math.floor(1e9 * (0.1 + 0.8 * ((i * 0.31 + Math.floor(f / 15) * 0.137) % 1))))}`, x, 294, 2.6),
    );
    // hatched decorative stripes
    const hatch = (x0: number, y0: number, w: number, hh: number, slant: number) => {
      ctx.globalAlpha = 0.85;
      ctx.beginPath();
      ctx.moveTo(x0, y0);
      ctx.lineTo(x0 + w * 0.45, y0);
      ctx.lineTo(x0 + w * 0.45 + slant, y0 + hh);
      ctx.lineTo(x0 + slant, y0 + hh);
      ctx.closePath();
      ctx.fill();
      ctx.globalAlpha = 1;
      h.poly([x0, y0, x0 + w, y0, x0 + w + slant, y0 + hh, x0 + slant, y0 + hh], 0.8, true);
      for (let x = x0 + w * 0.45 + 1.5; x < x0 + w; x += 2.2) h.line(x, y0, x + slant, y0 + hh, 0.6, false);
    };
    hatch(478, 305, 20, 7, 4);
    h.hline(500, 570, 312, 0.9);
    hatch(570, 307, 46, 7, -4);
    h.rect(625, 304, 54, 6);
    const g = (f % 120) / 120;
    h.fill(628, 305.5, 50 * g, 3, 0.75);
    hatch(684, 309, 40, 7, 4);
  }

  // LOADING side panel
  {
    h.text("LOADING" + ".".repeat(Math.floor(f / 8) % 9), 680, 168, 3.8);
    h.rect(678, 170.5, 63, 34.5);
    tinyLoading.forEach((l, i) => h.text(l.slice(0, 40), 681, 175 + i * 3.4, 1.8, { alpha: 0.85 }));
    h.fill(681, 179.4, 56, 1.8, 0.35);
    h.fill(681, 179.4, 56 * ((f % 150) / 150), 1.8, 1);
    h.rect(680, 211, 17, 4, 0.8);
    h.rect(700, 211, 17, 4, 0.8);
  }

  // ===== left lower blocks
  h.text("0225+013", 12, 366, 5.0, { font: "sans" });
  h.text("NETWORK", 12, 377, 9.2, { font: "sans", weight: 300 });
  h.text(`74,${String(1 + (Math.floor(f / 30) % 20) * 7).padStart(4, "0")}`, 14, 386, 4.4, { font: "sans" });
  h.fill(66, 400.5, 2, 2);
  h.text("[TERMINAL__294.393.75]", 69, 403, 3.6);
  h.text("41 0034 22.7", 72, 407, 2.0, { alpha: DIM });
  h.text("0163+001", 15, 421, 5.0, { font: "sans" });
  h.text("DATA", 15, 432, 9.2, { font: "sans", weight: 300 });
  h.text("1B__345", 16, 441, 4.4, { font: "sans" });
  h.fill(12, 456, 40, 16, 0.22);
  h.text("LAST", 20, 463, 5.4, { font: "sans", weight: 300 });
  h.text("UPDATED", 14, 470, 5.4, { font: "sans", weight: 300 });
  h.text("SAT 2091", 40, 476, 1.9, { alpha: DIM });
  h.text("NO 01.9.2.54", 75, 441, 5.2, { font: "sans", weight: 300 });
  h.text(`CODE 9.8.6.${pad2(1 + (Math.floor(f / 50) % 12))}`, 75, 464, 5.2, { font: "sans", weight: 300 });
  h.text("NO 00.78.7.1.1", 75, 481, 5.2, { font: "sans", weight: 300 });

  // disk block
  h.text("C 1____21: DISK", 180, 409, 5.8, { font: "sans" });
  h.text("DRIVE DISK 1 TO 682", 180, 415, 2.5);
  tinyDisk.forEach((l, i) => {
    if (i === 3 || i === 7) return;
    h.text(l.slice(0, 34), 149, 419 + i * 4.6, 1.8, { alpha: 0.85 });
  });
  for (const yb of [436.5, 468.5]) {
    h.fill(128, yb, 100, 1.6, 0.42);
    h.fill(128, yb + 2.6, 100, 1.6, 0.42);
    h.fill(128, yb + 5.2, 100 * (0.3 + 0.7 * ((f % 200) / 200)), 1.6, 0.42);
  }
  const big = tick(bigNumTable, 30, f);
  h.text(big[0], 259, 431, 9.4, { font: "sans", align: "center" });
  h.text(big[1], 259, 466, 9.4, { font: "sans", align: "center" });

  // three waveform strips
  waveStrips.forEach((wv, si) => {
    const y = [322, 349, 371][si];
    const amp = [4, 6, 7][si];
    const scroll = (f / LOOP) * 200 * (si + 1);
    const pts: number[] = [];
    for (let x = 0; x <= 135; x += 0.35) {
      const env = 0.3 + 0.7 * Math.abs(waveStripEnv[si].at((x + scroll) / 5));
      pts.push(200 + x, y + wv.at(x * 1.8 + scroll) * amp * env);
    }
    h.poly(pts, 0.8);
    if (si === 0) {
      for (let r = 0; r < 4; r++) {
        const p2: number[] = [];
        for (let x = 0; x <= 135; x += 1) p2.push(200 + x, y + waveSmooth[r].at(x / 6 + (f / LOOP) * 24) * 5);
        h.poly(p2, 0.45);
      }
    }
  });

  // line graph with dots
  graphPts.forEach((series, si) => {
    const pts: number[] = [];
    series.forEach((p, i) => {
      const x = 383 + i * 8.6;
      const y = 365 + si * 3 + (p.base * 0.6 + p.amp * Math.sin(TAU * (p.k * f / LOOP + p.ph))) * 13;
      pts.push(x, y);
    });
    h.poly(pts, si === 0 ? 0.9 : 0.35);
    if (si === 0) for (let i = 0; i < pts.length; i += 2) h.dot(pts[i], pts[i + 1], 1.5, 1);
  });

  // clock rows
  h.text(clock(f, 54, 1), 311, 411, 7.6, { font: "sans" });
  h.text("lpef....678---y", 358, 410, 4.0, { alpha: 0.85 });
  h.text("02O63", 402, 410, 4.0);
  h.text("6", 436, 410, 4.0);
  ["76", "7", "476", "56 324 2 89", "LINE"].forEach((s, i) => h.text(s, [518, 535, 568, 581, 622][i], 410, 4.0));
  h.rect(302, 426.5, 5, 4, 0.9);
  h.rect(304, 425, 5, 4, 0.9);
  h.text(clock((f + 450) % LOOP, 87, 34), 311, 432, 7.6, { font: "sans" });
  h.text("fgtf....157---x", 358, 431, 4.0, { alpha: 0.85 });
  h.text("13P54", 402, 431, 4.0);
  h.text("9", 436, 431, 4.0);
  ["8", "35", "c", "1", "45 768 0 98", "CLOSED"].forEach((s, i) => h.text(s, [495, 517, 538, 571, 581, 622][i], 431, 4.0));

  // timeline ruler
  for (let i = 0; i <= 10; i++) h.text(String(i), 312 + i * 31.8, 456, 3.6, { align: "center", alpha: 0.85 });
  for (let i = 0; i <= 160; i++) h.vline(311 + i * 2, i % 8 === 0 ? 462 : 465, 468, i % 8 === 0 ? 0.9 : 0.6);
  h.fill(311, 476, 330, 1.3, 0.45);
  h.fill(311, 476, 330 * (f / LOOP), 1.3, 1);

  // ===== right lower blocks
  {
    h.rect(684, 348, 67, 43);
    h.hline(690, 742, 354, 0.8);
    h.fill(690, 353, 20 + 30 * (0.5 + 0.5 * Math.sin(TAU * f / 200)), 1.6, 0.6);
    tinySmallPanel.forEach((l, i) => h.text(l, 690, 360 + i * 7, 2.4, { alpha: 0.9 }));
    for (const x of [770, 824, 845, 856, 866]) h.vline(x, 341, 355, 0.85);
    // noisy bar
    for (let i = 0; i < 90; i++) {
      const v = (Math.sin(i * 12.9898 + Math.floor(f / 3) * 0.7) * 43758.5453) % 1;
      h.fill(757 + i * 1.2, 369, 1.2, 9, 0.25 + 0.5 * Math.abs(v));
    }
    h.text(`T.D: IVE___DATA ${pad2(Math.floor(f / 20) % 60)}/56`, 759, 386, 3.4);
    h.text("UNIT CODE :", 720, 420, 6.6, { font: "sans", weight: 300 });
    h.text("HL", 823, 420, 6.6, { font: "sans" });
    h.text(tick(unitCodeTable, 40, f), 833, 415, 2.6);
    h.text("GI", 842, 420, 6.6, { font: "sans" });
    h.hline(722, 852, 430.5, 0.7);
    h.rect(723, 437, 132, 12, 0.8);
    h.fill(723, 437, 15, 12, 0.35);
    h.text("MR", 730.5, 446, 5.0, { font: "sans", align: "center" });
    h.text("524", 742, 441, 2.4);
    const up = (f % 200) / 200;
    const grad = ctx.createLinearGradient(757, 0, 840, 0);
    grad.addColorStop(0, "rgba(232,232,232,0.95)");
    grad.addColorStop(Math.min(0.99, up), "rgba(232,232,232,0.6)");
    grad.addColorStop(1, "rgba(232,232,232,0.05)");
    ctx.fillStyle = grad;
    ctx.fillRect(h.e(757), h.e(440), h.e(757 + 83 * Math.max(0.05, up)) - h.e(757), h.e(447) - h.e(440));
    ctx.fillStyle = h.color;
    // dot-matrix digits
    const dd = tick(dotDigitsTable, 50, f);
    dd.forEach((dgt, di) => {
      const pat = DIGITS[dgt];
      for (let r = 0; r < 7; r++)
        for (let c = 0; c < 5; c++) {
          const on = pat[r * 5 + c] === "1";
          h.fill(667 + di * 26 + c * 4.3, 402 + r * 4.6, 2.6, 2.6, on ? 0.9 : 0.1);
        }
    });
    for (let i = 0; i < 4; i++) h.fill(648 + i * 4.3, 402 + ((i * 3) % 7) * 4.6, 2.6, 2.6, 0.5);
    for (let i = 0; i < 18; i++) h.hline(674 + i * 12, 674 + i * 12 + 9, 465.5, 0.7);
    for (let i = 0; i < 14; i++) {
      const on = (Math.floor(f / 12) + i * 7) % 5;
      h.fill(712 + i * 9, 486, on === 0 ? 3.6 : 2.2, on === 0 ? 3.6 : 2.2, 0.25 + on * 0.15);
    }
  }
};
