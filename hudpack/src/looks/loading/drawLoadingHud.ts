import { Hud } from "../../lib/hud";
import { fillerLine } from "../../lib/loop";
import { mulberry32 } from "../../lib/random";
import { clamp01, easeInOutCubic, easeOutCubic, progress } from "../../lib/ease";

// Design space: the reference's own 596x336 pixel grid.
export const LD_W = 596;
const FPS = 30;

const rng = mulberry32(0x10ad1e);

// ---------------------------------------------------------------- data

const leftText = Array.from({ length: 84 }, () => fillerLine(rng, 8 + Math.floor(rng() * 22)));
const rightCode = [
  "      }",
  "   }",
  "  sel",
  "  return;",
  "",
  "/*",
  " *  SHIFT the unit table into the ring. We can not safely",
  " *  rotate it while the lock is held",
  " */",
  "UNIT_DEFINE(set_units, sigma, qid_t __ring *, unitlist)",
  "{",
  "  struct unit_map *unit_map;",
  "  int retval;",
  "  if (!probe_allowed(CAP_SETQID))",
  "    return -EPRM;",
  "  if ((unsigned)setsize > NQUNITS_",
  "    return -",
  "  unit_map = units_alloc(setsiz",
  "  if (!unit_map)",
  "    return -;",
  "",
  "  retval = units_from_ring(unit",
  "",
  "  if (retval) {",
  "",
  "    put_unit_map(unit_map);",
  "",
  "    return retval;",
  "  }",
  "",
  "",
  "  retval = set_live_units(unit_map);",
  "",
  "  put_unit_map(unit_map);",
  "",
  "",
  "  return retval;",
  "}",
];
const tableRows = ["PATH CONTROL", "LOCATION", "NAVIGATION", "INDEX", "AREA CODE", "PORT"];
const tableVals = ["ON", "37.762", "8.0.762", "746", "317046", "F 87 . 0N"];
const boxCodes = [
  ["8 034 D92", "8 034 D92", "8 034 D92", "C 145 E13", "D 256 F24", "W 145 D13", "X 090 Z08", "C 145 E13"],
  ["J 812 L80", "G 089 I07", "D 256 F24", "C 145 E13", "Z 812 B80", "F 470 H88", "W 089 Y07", "D 256 F24"],
];
const statusCodes = [
  "initialising_data_(k7fq_21-098)",
  "parsing_index_(m2rt_08-551)",
  "syncing_nodes_(qz4w_33-120)",
  "verifying_blocks_(h9tx_17-402)",
  "mapping_sectors_(v3pd_92-076)",
  "indexing_keys_(r8lm_45-310)",
];
const codeLines = [
  "K891  21MB  17OE  85QZ",
  "J780  10LA  06ND  74PY",
  "L902  32NC  29PF  88RA",
  "M214  47QD  51TB  09WX",
];

// Barcode stripes: seeded widths and gaps across the bar.
const stripes = (() => {
  const out: { x: number; w: number; a: number; on: number }[] = [];
  let x = 0;
  while (x < 1) {
    // wide blocks, often as a light/mid-grey pair
    const w = 0.003 + rng() * rng() * 0.05;
    // each stripe switches on when the load passes its own seeded threshold,
    // so the bar fills across its whole width, not left to right
    out.push({ x, w, a: 0.75 + rng() * 0.2, on: rng() * 0.92 });
    if (rng() < 0.55) {
      const w2 = 0.006 + rng() * 0.025;
      out.push({ x: x + w, w: w2, a: 0.35 + rng() * 0.25, on: rng() * 0.92 });
      x += w2;
    }
    x += w + 0.003 + Math.pow(rng(), 2.5) * 0.09;
  }
  return out;
})();

const numberRows = Array.from({ length: 10 }, () => ({ int: 1 + Math.floor(rng() * 290), seed: Math.floor(rng() * 1e6) }));
const areaPts = Array.from({ length: 21 }, (_, i) => 0.25 + 0.55 * (0.5 + 0.5 * Math.sin(i * 0.9 + rng() * 2)) * (0.6 + 0.4 * (i / 20)));
const wavePts = Array.from({ length: 64 }, (_, i) => i);

// ---------------------------------------------------------------- helpers

/** Deterministic pseudo-random decimals for a value at a given step. */
const digits = (seed: number, step: number, n: number) => {
  let s = "";
  let v = (seed * 2654435761 + step * 40503) >>> 0;
  for (let i = 0; i < n; i++) {
    v = (Math.imul(v ^ (v >>> 13), 1274126177) + 12345) >>> 0;
    s += String(v % 10);
  }
  return s;
};

/** Polyline drawn on progressively: p in [0,1] of its total length. */
const drawOn = (h: Hud, pts: number[], p: number, a = 1) => {
  if (p <= 0) return;
  if (p >= 1) return h.poly(pts, a, false, true);
  let total = 0;
  for (let i = 2; i < pts.length; i += 2) total += Math.hypot(pts[i] - pts[i - 2], pts[i + 1] - pts[i - 1]);
  let left = total * p;
  const out = [pts[0], pts[1]];
  for (let i = 2; i < pts.length; i += 2) {
    const sl = Math.hypot(pts[i] - pts[i - 2], pts[i + 1] - pts[i - 1]);
    if (left >= sl) {
      out.push(pts[i], pts[i + 1]);
      left -= sl;
    } else {
      const u = left / sl;
      out.push(pts[i - 2] + (pts[i] - pts[i - 2]) * u, pts[i - 1] + (pts[i + 1] - pts[i - 1]) * u);
      break;
    }
  }
  h.poly(out, a, false, true);
};

/** Smooth S-bend from (x0,y0) to (x1,y1), as points. */
const bend = (x0: number, y0: number, x1: number, y1: number) => {
  const pts: number[] = [];
  for (let i = 0; i <= 16; i++) {
    const t = i / 16;
    const e = t * t * (3 - 2 * t);
    pts.push(x0 + (x1 - x0) * t, y0 + (y1 - y0) * e);
  }
  return pts;
};

// ---------------------------------------------------------------- timing

export const loadingState = (frame: number) => {
  const t = frame / FPS;
  const load = easeInOutCubic(progress(t, 1, 10));
  const pct = Math.round(load * 100);
  return { t, load, pct };
};

// ---------------------------------------------------------------- draw

export const drawLoadingHud = (ctx: CanvasRenderingContext2D, bw: number, _bh: number, frame: number, color = "#E8E8E8") => {
  const h = new Hud(ctx, bw, LD_W, color);
  h.smallTextAlpha = 0.8;
  h.strokeAlpha = 0.85;
  const { t, load, pct } = loadingState(frame);
  const drawP = easeInOutCubic(progress(t, 0, 1)); // frame lines draw on
  const fade = (delay: number) => easeOutCubic(progress(t, 0.25 + delay, 0.9 + delay)); // panels fade in
  const flash = t >= 10 && t <= 10.5 ? Math.sin(Math.PI * progress(t, 10, 10.5)) : 0;
  const done = t >= 10;
  // small values keep flickering gently during the hold: step every 4 frames
  // while loading, every 12 frames after.
  const step = done ? 1000 + Math.floor(frame / 12) : Math.floor(frame / 4);

  // ===== left text panel
  {
    const a = fade(0);
    h.vline(17, 31, 312, 0.7 * a);
    for (let y = 33; y < 312; y += 3.3) h.hline(16, 18, y, 0.6 * a);
    h.dot(17, 312, 1, a);
    drawOn(h, [20, 31, 76, 31, 76, 312, 20, 312, 20, 31], drawP, 0.9);
    leftText.forEach((l, i) => {
      const y = 35.5 + i * 3.3;
      if (y > 166 && y < 182) return;
      h.text(l, 28, y, 2.3, { font: "sans", alpha: 0.85 * a });
    });
    h.rect(27, 168, 33, 12, 0.8 * a);
    h.text("SEARCH NODE ON FOR", 30, 171.5, 1.7, { font: "sans", alpha: a });
    h.text("DATA: 0046", 33, 174.5, 1.7, { font: "sans", alpha: a });
    h.text("SEARCHING: 1C COD", 31, 177.5, 1.7, { font: "sans", alpha: a });
  }

  // ===== y-axis ruler
  {
    drawOn(h, [83, 37, 89, 37, 89, 49, 82, 58, 82, 282, 88, 292, 88, 297], drawP);
    h.rect(84, 39, 3, 8, 0.8 * fade(0));
    for (let i = 0; i < 4; i++) h.hline(84.5, 86.5, 40.5 + i * 2, 0.8 * fade(0));
    drawOn(h, [90, 40, 90, 296], drawP);
    h.circle(90, 297.5, 1.4, drawP);
    for (let v = 2200, i = 0; v >= 900; v -= 100, i++) {
      const y = 64.5 + i * 16.15;
      h.hline(88, 92, y, drawP);
      h.text(String(v), 96, y + 2.3, 6.4, { font: "sans", alpha: fade(i * 0.02) });
    }
    // dashed guide
    for (let y = 82; y < 268; y += 8) h.vline(84.5, y, y + 5, 0.7 * fade(0));
    // marker climbing with the load (from 900 up to 2200)
    const my = 274.5 - load * (274.5 - 64.5);
    h.fillSmooth(95, my - 4, 18, 8, 0.42 * fade(0.1));
    h.ctx.globalAlpha = fade(0.1);
    h.ctx.beginPath();
    h.ctx.moveTo(116, my);
    h.ctx.lineTo(120.5, my - 3);
    h.ctx.lineTo(120.5, my + 3);
    h.ctx.closePath();
    h.ctx.fill();
    h.ctx.globalAlpha = 1;
  }

  // ===== top: mini bars, tick ruler, box rows
  {
    const a = fade(0.05);
    const tb = [0.28, 0.41, 0.53].map((v, i) => clamp01(v + load * [0.72, 0.59, 0.47][i] * (1 - i * 0.05)));
    tb.forEach((v, i) => {
      const y = 37 + i * 4;
      h.rect(117, y, 44, 2.6, 0.7 * a);
      h.fill(117.5, y + 0.4, 43 * v, 1.8, a);
      h.text(`${Math.round(v * 100)}%`, 164, y + 2.6, 2.6, { font: "sans", alpha: a });
    });
    for (let i = 0; i < 12; i++) {
      const x = 217 + i * 7.3;
      h.text(String(100 + i * 10 + (i % 3) * 7), x, 21, 1.5, { font: "sans", alpha: 0.6 * a, align: "center" });
      h.vline(x, 22.5, 25.5, 0.8 * a);
      h.hline(x - 1, x + 1, 24, a);
    }
    h.hline(216, 330, 24, 0.5 * a);
    const sq = Math.round(5 + load * 33);
    for (let i = 0; i < 38; i++) h.fill(342 + i * 2.2, 23.5, 1.5, 1.5, i < sq ? a : 0.15 * a);
    h.rrect(341, 22.5, 86, 3.2, 1.5, 0.4 * a);

    boxCodes.forEach((row, r) => {
      row.forEach((code, i) => {
        const x = 181 + i * 29.8;
        const y = 36 + r * 11;
        h.rrect(x, y, 27, 7, 1.5, 0.85 * a);
        const flick = (step + i * 3 + r * 7) % 23 === 0;
        h.text(flick ? code.replace(/\d/g, (d) => String((Number(d) + 3) % 10)) : code, x + 13.5, y + 4.9, 2.3, { font: "sans", align: "center", alpha: a });
      });
    });
    h.hline(182, 415, 45.5, 0.7 * a);
    h.dot(243 + load * 100, 45.5, 1.3, a);
    // leaders to the small loading tag
    h.poly([403, 57, 422, 57, 427, 52, 448, 52, 452, 47], 0.8 * a, false, true);
    h.rect(452, 41, 22, 7, 0.8 * a);
    h.text("ROUTE 64", 455, 43.7, 1.5, { alpha: a });
    h.text("v.204", 467, 46.6, 1.5, { alpha: a });
    h.text("LOADING" + ".".repeat(Math.floor(frame / 6) % 7), 453, 54.5, 2.5, { font: "sans", alpha: a });
    h.hline(474, 480, 50, 0.8 * a);
    h.dot(480, 50, 0.8, a);
    h.rect(425, 52, 18, 4, 0.7 * a);
    h.text(String(3000 + pct * 3).padStart(5, "0"), 434, 55, 1.6, { align: "center", alpha: a });
  }

  // ===== main frame
  {
    const fl = flash;
    const mainA = 1;
    drawOn(h, [148, 70.5, 472, 70.5, 472, 250], drawP, mainA);
    drawOn(h, [133, 70.5, 127, 70.5, 127, 110], drawP, mainA);
    drawOn(h, [127, 128, 127, 262, 132, 262], drawP, mainA);
    for (let y = 130; y < 260; y += 4) h.vline(124.5, y, y + 2.2, 0.6 * drawP);
    h.ctx.globalAlpha = drawP;
    h.ctx.beginPath();
    h.ctx.moveTo(127, 119);
    h.ctx.lineTo(131, 126);
    h.ctx.lineTo(123, 126);
    h.ctx.closePath();
    h.ctx.fill();
    h.ctx.globalAlpha = 1;
    // x axis with arrow
    drawOn(h, [132, 262.5, 458, 262.5], drawP);
    drawOn(h, [178, 266.5, 458, 266.5], drawP);
    // bracket tab under the axis
    drawOn(h, [150, 271, 160, 271, 165, 266.5], drawP, 0.8);
    drawOn(h, [408, 266.5, 414, 271, 455, 271], drawP, 0.8);
    if (drawP > 0.95) {
      h.ctx.beginPath();
      h.ctx.moveTo(466, 264.5);
      h.ctx.lineTo(459, 260.5);
      h.ctx.lineTo(459, 268.5);
      h.ctx.closePath();
      h.ctx.fill();
    }
    [10, 20, 30, 40, 50].forEach((v, i) => {
      const x = 194 + i * 46;
      h.text(String(v), x, 268.5, 3.6, { font: "sans", align: "center", alpha: fade(0.1) });
      if (v === 40) h.rect(x - 4.5, 263.5, 9, 6, fade(0.1));
    });

    const ia = fade(0.15);
    // line A with a dotted wave
    drawOn(h, [162, 95, 216, 95, ...bend(216, 95, 236, 103).slice(2), 427, 103], drawP);
    h.dot(180 + load * 6, 95.5, 2.3, ia);
    // dense row of short ticks under a soft sine envelope
    for (const i of wavePts) {
      for (const k of [0, 0.5]) {
        const x = 241 + (i + k) * 2.85;
        const env = 0.6 + 2.6 * Math.max(0, Math.sin((i + k) / 9 + frame / 40) * 0.6 + Math.sin((i + k) / 4.1) * 0.4);
        h.line(x, 102.5 - env, x, 102.5, 0.8 * ia, false);
      }
    }
    for (let i = 0; i < 11; i++) h.text(String(70 + ((i * 37) % 30)), 248 + i * 15.5, 110, 1.6, { align: "center", alpha: 0.6 * ia });
    // line B: the progress line, its node and the percentage bubble
    const nodeX = 300 + load * 104;
    drawOn(h, [162, 110, 207, 110, ...bend(207, 110, 247, 132).slice(2), 408, 132], drawP);
    h.dot(196, 110, 2.3, ia);
    h.dot(nodeX, 132, 2.1, ia);
    h.dot(408, 132, 1.2, ia);
    h.ctx.lineWidth = h.lw * 1.4;
    h.rrect(415, 123.5, 23.5, 15, 7.5, ia);
    h.ctx.lineWidth = h.lw;
    h.text(`${pct}%`, 426.75, 133.8, 7.6, { font: "sans", weight: 300, align: "center", alpha: ia });
    // line C and D
    drawOn(h, [162, 148, 209, 148, ...bend(209, 148, 228, 141.5).slice(2), 335, 141.5], drawP);
    h.dot(219, 144.5, 1.2, ia);
    drawOn(h, [348, 115, 428, 115], drawP);
    h.dot(348, 115, 0.9, ia);
    h.dot(418, 115, 1.4, ia);
    h.text("G 21", 340, 141, 7.0, { font: "sans", weight: 300, alpha: ia });
    for (let i = 0; i < 4; i++) h.text(digits(7, step + i, 4), 346, 144 + i * 2.2, 1.5, { alpha: 0.75 * ia });
    h.text("LOADING", 165, 126, 5.0, { font: "sans", alpha: ia });
    h.text("Elementum eu, mattis auctor", 165, 130, 2.0, { font: "sans", alpha: 0.8 * ia });
    h.text("mattis, amet vivamus orfus", 165, 133, 2.0, { font: "sans", alpha: 0.8 * ia });

    // numbers column
    numberRows.forEach((n, i) => {
      h.text(`${(n.int + (step % 7) * (i % 3)) % 300} ,${digits(n.seed, step, 4)}`, 187, 162.5 + i * 7.9, 7.4, { font: "sans", weight: 300, align: "right", alpha: ia });
    });

    // barcode bar
    const bx = 195;
    const bwid = 220;
    h.rect(bx, 186.5, bwid, 12.5, ia);
    for (const s of stripes) {
      if (s.on > 0.05 + 0.95 * Math.pow(load, 0.55) || s.x + s.w > 1) continue;
      h.fill(bx + s.x * bwid, 158, s.w * bwid, 28.5, s.a * 0.92);
    }
    h.fillSmooth(bx + 1.2, 188, (bwid - 2.4) * (0.35 + 0.65 * load), 9.5, 0.42);
    const tiny = "unit_map_data, mod11 ";
    h.text(tiny.repeat(8).slice(0, Math.floor(110 * (0.35 + 0.65 * load))), bx + 2, 194, 2.2, { alpha: 0.9 * ia });
    h.vline(433, 128, 222, 0.7 * ia);
    h.fill(432, 214 - load * 80, 2, 8, ia);
    h.hline(343, 432, 236.5, 0.8 * ia);
    h.hline(343, 432, 240.5, 0.6 * ia);
    h.hline(178, 300, 248.5, 0.6 * ia);

    // status line
    const status = done ? "data_loaded" : statusCodes[Math.min(statusCodes.length - 1, Math.floor(progress(t, 1, 10) * statusCodes.length))];
    h.text(status, 192, 218, 10.2, { font: "sans", weight: 300, alpha: ia });

    // flash at 100 %: re-stroke the frame brighter with a soft bloom
    if (fl > 0) {
      const c = h.ctx;
      c.save();
      c.shadowColor = "rgba(255,255,255,0.9)";
      c.shadowBlur = 4 * h.k * fl;
      c.strokeStyle = "#FFFFFF";
      c.lineWidth = h.lw * (1 + fl);
      c.globalAlpha = fl;
      c.beginPath();
      c.moveTo(h.s(148), h.s(70.5));
      c.lineTo(h.s(472), h.s(70.5));
      c.lineTo(h.s(472), h.s(250));
      c.moveTo(h.s(133), h.s(70.5));
      c.lineTo(h.s(127), h.s(70.5));
      c.lineTo(h.s(127), h.s(110));
      c.moveTo(h.s(127), h.s(128));
      c.lineTo(h.s(127), h.s(262));
      c.lineTo(h.s(458), h.s(262.5));
      c.stroke();
      c.beginPath();
      c.roundRect(h.s(415), h.s(123.5), 23.5, 15, 7.5);
      c.stroke();
      c.restore();
    }
  }

  // ===== right panel
  {
    const a = fade(0.2);
    h.vline(491, 28, 250, 0.7 * drawP);
    h.text("DATA INPUTS", 496, 25, 2.5, { font: "sans", alpha: a });
    h.hline(496, 513, 26.2, 0.7 * a);
    h.text("LOADING", 521, 25, 2.5, { font: "sans", alpha: a });
    h.hline(521, 533, 26.2, 0.7 * a);
    h.text(`V 234 ${digits(3, step, 3)} 44 / 567 (c)`, 540, 25, 2.5, { font: "sans", alpha: a });
    h.hline(540, 573, 26.2, 0.7 * a);
    drawOn(h, [568, 20.5, 582, 20.5, 582, 190, 573, 190], drawP, 0.8);
    // code scrolls in as data loads
    const lines = Math.floor(6 + load * (rightCode.length - 6));
    rightCode.slice(0, lines).forEach((l, i) => h.text(l, 500, 31.5 + i * 3.75, 1.9, { alpha: 0.85 * a }));
    h.rect(538, 77, 44, 38, 0.6 * a);
    tableRows.forEach((r, i) => {
      h.text(r, 546, 83 + i * 5.3, 1.9, { font: "sans", alpha: a });
      h.text(i === 1 ? `${37 + (step % 5)}.762` : tableVals[i], 562, 83 + i * 5.3, 1.9, { font: "sans", alpha: a });
    });
    h.vline(541, 81, 111, 0.4 * a);
    h.fill(540.5, 98 - load * 15, 1.6, 10, a);
    h.hline(494, 576, 184.5, 0.8 * a);
    h.rrect(494, 186, 81, 2.4, 1.2, 0.8 * a);
    h.dot(494, 184.5, 0.9, a);
    h.dot(576, 184.5, 0.9, a);

    // three progress bars, each with its own rate and final value
    for (let i = 0; i < 12; i++) h.dot(503 + i * 5.4, 198, 0.45, 0.7 * a);
    h.rect(494, 201, 87, 35, 0.4 * a);
    const finals = [100, 96, 100];
    const rates = [1.15, 0.9, 1.0];
    finals.forEach((fin, i) => {
      const y = 204 + i * 11.6;
      const start = [39, 41, 45][i];
      const val = Math.round(start + (fin - start) * easeInOutCubic(progress(t, 1, 1 + 9 / rates[i])));
      h.fill(495, y - 0.5, 1.4, 6.5, a);
      h.fill(498, y + 1, 60, 3.6, 0.25 * a);
      h.fill(498, y + 1, 60 * (val / 100), 3.6, 0.92 * a);
      h.text(`${val}%`, 579, y + 4.6, 4.6, { font: "sans", weight: 300, align: "right", alpha: a });
    });
    const ci = Math.min(codeLines.length - 1, Math.floor(progress(t, 1, 10) * codeLines.length));
    h.text(codeLines[done ? 0 : ci], 499, 252, 5.6, { font: "sans", weight: 300, alpha: a });

    // two rounded boxes
    [
      { y: 256, start: 25, rate: 1.0 },
      { y: 291, start: 42, rate: 1.25 },
    ].forEach((b) => {
      h.rrect(487, b.y, 98, 23, 3, a);
      const v = Math.round(b.start + (100 - b.start) * easeInOutCubic(progress(t, 1, 1 + 9 / b.rate)));
      const cy = b.y + 11.5;
      h.hline(497, 526, cy, 0.8 * a);
      h.hline(550, 576, cy, 0.8 * a);
      h.poly([529, cy - 4.5, 526.5, cy, 529, cy + 4.5], a);
      h.poly([547, cy - 4.5, 549.5, cy, 547, cy + 4.5], a);
      h.hline(529, 547, cy - 4.5, a);
      h.hline(529, 547, cy + 4.5, a);
      h.text(`${v}%`, 538, cy + 2.6, 7.0, { font: "sans", weight: 300, align: "center", alpha: a });
      const ly = b.y + 28;
      h.text("LOADING", 500, ly - 0.5, 1.8, { font: "sans", alpha: a });
      h.poly([497, ly + 1.5, 517, ly + 1.5, 520, ly + 3.5, 570, ly + 3.5], 0.8 * a);
      for (let x = 521; x < 520 + 49 * (v / 100); x += 1.7) h.line(x, ly + 1.6, x + 1, ly + 3.4, 0.9 * a, false);
    });
    h.hline(490, 583, 322.5, 0.6 * a);
  }

  // ===== bottom row
  {
    const a = fade(0.3);
    // area chart, slowly rising with the load
    h.fill(102, 291, 49, 25, 0.12 * a);
    const pts: number[] = [];
    areaPts.forEach((v, i) => {
      const x = 102 + i * 2.45;
      const vv = v * (0.75 + 0.25 * load) + 0.04 * Math.sin(frame / 18 + i);
      pts.push(x, 316 - vv * 22);
    });
    h.ctx.globalAlpha = 0.35 * a;
    h.ctx.beginPath();
    h.ctx.moveTo(102, 316);
    for (let i = 0; i < pts.length; i += 2) h.ctx.lineTo(pts[i], pts[i + 1]);
    h.ctx.lineTo(151, 316);
    h.ctx.closePath();
    h.ctx.fill();
    h.ctx.globalAlpha = 1;
    h.poly(pts, a);

    [0.4, 0.37].forEach((v0, i) => {
      const y = 297 + i * 12;
      const v = Math.round((v0 + (1 - v0) * load) * 100);
      h.fill(157, y, 36, 7, 0.32 * a);
      h.fill(157, y, 36 * (v / 100), 7, 0.08 * a);
      h.rect(157, y, 21, 7, 0.9 * a);
      h.text(`${v}%`, 158.5, y + 5.2, 4.2, { font: "sans", alpha: a });
    });
    h.text("Basic characteristic", 202, 299.5, 2.5, { font: "sans", alpha: a });
    h.text("Sample", 252, 297.5, 2.5, { font: "sans", alpha: a });
    h.hline(252, 260, 298.5, 0.6 * a);
    h.hline(200, 278, 301.5, 0.6 * a);
    h.text("Limit", 202, 306, 2.5, { font: "sans", alpha: a });
    h.text(String(12 + (step % 3)), 255, 306, 2.5, { font: "sans", alpha: a });
    h.hline(200, 278, 308.5, 0.6 * a);
    h.text("Index", 202, 313.5, 2.5, { font: "sans", alpha: a });
    h.text(String(5 + (step % 2)), 255, 313.5, 2.5, { font: "sans", alpha: a });
    h.hline(200, 278, 316, 0.6 * a);
    h.text(String(70 + (step % 9)), 287, 306, 2.2, { font: "sans", alpha: 0.7 * a });
    h.text(String(66 - (step % 5)), 287, 315, 2.2, { font: "sans", alpha: 0.7 * a });

    h.fill(299, 302.5, 30, 6, 0.18 * a);
    h.text("DHS69 BKI 12", 300, 307, 3.0, { font: "sans", alpha: a });
    h.text(`UN ${digits(11, step, 3)} SBZ 89`, 300, 314.5, 3.0, { font: "sans", alpha: a });
    h.text("01-r.p FU", 341, 307, 3.0, { font: "sans", alpha: a });
    h.text(`${digits(5, step, 2)} pn d5`, 341, 314.5, 3.0, { font: "sans", alpha: a });
    h.text(String(90 - (step % 4)), 376, 307, 3.0, { font: "sans", alpha: a });
    h.text(String(34 + (step % 6)), 376, 314.5, 3.0, { font: "sans", alpha: a });
    h.text("C1 Q6 UB N6A", 395, 307, 3.0, { font: "sans", alpha: a });
    h.text("E3 S6 WE P86", 395, 314.5, 3.0, { font: "sans", alpha: a });
    h.text("H 2", 442, 309, 8.0, { font: "sans", alpha: a });
    for (let i = 0; i < 4; i++) h.text(digits(23, step + i, 6), 443, 312 + i * 1.8, 1.3, { alpha: 0.6 * a });
  }
};
