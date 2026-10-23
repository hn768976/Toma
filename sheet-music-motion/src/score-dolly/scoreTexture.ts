import { Rng, mulberry32, pick, range } from "../shared/random";
import {
  HEAD_RX,
  bassClef,
  beam,
  brace,
  dot,
  flags,
  flat,
  noteHead,
  slur,
  staffLines,
  stem,
  stemX,
  trebleClef,
  fontGlyph,
} from "../shared/notation";
import { GLYPH } from "../shared/font";

export const SCORE_W = 8192;
export const SCORE_H = 4096;
export const STAFF_SPACE = 34;
export const SYSTEM_GAP = 19; // staff spaces between successive grand staves
export const FIRST_SYSTEM_Y = 7; // staff spaces from top to first treble staff

const INK = "rgba(38, 22, 9, 0.93)";

type Ev = {
  dur: number; // in quarters
  kind: "note" | "rest";
  pitches: number[]; // half-space steps above the bottom staff line
  flagCount: number; // 0 quarter/half/whole, 1 eighth, 2 sixteenth
  filled: boolean;
  stemmed: boolean;
  dotted: boolean;
  group: number; // beam group id (-1 = none)
  accidental: boolean;
};

// Rhythmic templates for a 4/4 bar. Each entry: [duration, flags, filled, stemmed, dotted]
type Tpl = [number, number, boolean, boolean, boolean][];
const Q: Tpl[number] = [1, 0, true, true, false];
const E: Tpl[number] = [0.5, 1, true, true, false];
const S: Tpl[number] = [0.25, 2, true, true, false];
const H: Tpl[number] = [2, 0, false, true, false];
const W: Tpl[number] = [4, 0, false, false, false];
const DQ: Tpl[number] = [1.5, 0, true, true, true];
const TEMPLATES: Tpl[] = [
  [Q, Q, Q, Q],
  [E, E, E, E, E, E, E, E],
  [H, Q, Q],
  [DQ, E, H],
  [E, E, Q, E, E, Q],
  [Q, E, E, E, E, E, E],
  [S, S, S, S, Q, H],
  [H, H],
  [W],
  [Q, Q, E, E, E, E],
];

const makeBar = (rng: Rng, pitch: { p: number }, groupStart: number) => {
  const tpl = pick(rng, TEMPLATES);
  const evs: Ev[] = [];
  let group = groupStart;
  let beat = 0;
  let prevBeamed = false;
  for (const [dur, flagCount, filled, stemmed, dotted] of tpl) {
    pitch.p = Math.max(-3, Math.min(11, pitch.p + Math.round(range(rng, -3.4, 3.4))));
    const chord = flagCount === 0 && rng() < 0.28;
    const pitches = chord ? [pitch.p - 2, pitch.p, pitch.p + 2].slice(rng() < 0.5 ? 1 : 0) : [pitch.p];
    const beamed = flagCount > 0;
    // A new beam group starts on each beat boundary.
    if (beamed && (!prevBeamed || Math.abs(beat - Math.round(beat)) < 1e-6)) group++;
    const rest = flagCount === 0 && dur === 1 && rng() < 0.1;
    evs.push({
      dur,
      kind: rest ? "rest" : "note",
      pitches,
      flagCount,
      filled,
      stemmed,
      dotted,
      group: beamed ? group : -1,
      accidental: rng() < 0.07,
    });
    prevBeamed = beamed;
    beat += dur;
  }
  return { evs, group };
};

const pitchY = (bottom: number, p: number, s: number) => bottom - (p * s) / 2;

const ledger = (ctx: CanvasRenderingContext2D, x: number, bottom: number, p: number, s: number) => {
  const w = HEAD_RX * 2.9 * s;
  for (let q = -2; q >= p; q -= 2) {
    ctx.fillRect(x - w / 2, pitchY(bottom, q, s) - 0.05 * s, w, 0.1 * s);
  }
  for (let q = 10; q <= p; q += 2) {
    ctx.fillRect(x - w / 2, pitchY(bottom, q, s) - 0.05 * s, w, 0.1 * s);
  }
};

const drawStaffMusic = (
  ctx: CanvasRenderingContext2D,
  rng: Rng,
  x0: number,
  x1: number,
  top: number,
  s: number,
) => {
  const bottom = top + 4 * s;
  const pitch = { p: Math.round(range(rng, 2, 7)) };
  let x = x0;
  let group = 0;
  while (x < x1 - 12 * s) {
    const bar = makeBar(rng, pitch, group);
    group = bar.group;
    const evs = bar.evs;
    const widths = evs.map((e) => 1.15 * s + Math.sqrt(e.dur) * 2.3 * s);
    const placed = evs.map((e, i) => {
      const ex = x + 1.6 * s + widths.slice(0, i).reduce((a, b) => a + b, 0);
      return { e, x: ex };
    });
    const barEnd = x + 1.6 * s + widths.reduce((a, b) => a + b, 0) + 0.6 * s;
    if (barEnd > x1) break;

    // Group beamed events.
    const groups = new Map<number, typeof placed>();
    for (const pl of placed) {
      if (pl.e.group >= 0 && pl.e.kind === "note") {
        const g = groups.get(pl.e.group) ?? [];
        g.push(pl);
        groups.set(pl.e.group, g);
      }
    }

    for (const { e, x: ex } of placed) {
      if (e.kind === "rest") {
        fontGlyph(ctx, GLYPH.quarterRest, ex - 0.6 * s, bottom, s);
        continue;
      }
      for (const p of e.pitches) {
        noteHead(ctx, ex, pitchY(bottom, p, s), s, e.filled);
        ledger(ctx, ex, bottom, p, s);
        if (e.dotted) dot(ctx, ex + 1.2 * s, pitchY(bottom, p % 2 === 0 ? p + 1 : p, s), s);
      }
      if (e.accidental) flat(ctx, ex - 1.9 * s, pitchY(bottom, e.pitches[0], s), s);
      const g = e.group >= 0 ? groups.get(e.group) : undefined;
      if (e.stemmed && (!g || g.length < 2)) {
        const avg = e.pitches.reduce((a, b) => a + b, 0) / e.pitches.length;
        const up = avg < 4;
        const hi = Math.max(...e.pitches);
        const lo = Math.min(...e.pitches);
        const sx = stemX(ex, s, up);
        const yStart = pitchY(bottom, up ? lo : hi, s);
        const yTip = up ? pitchY(bottom, hi, s) - 3.4 * s : pitchY(bottom, lo, s) + 3.4 * s;
        stem(ctx, sx, yStart, yTip, s);
        if (e.flagCount > 0) flags(ctx, sx, yTip, s, up, e.flagCount);
      }
    }

    // Beams for groups of 2+.
    for (const g of groups.values()) {
      if (g.length < 2) continue;
      const all = g.flatMap((pl) => pl.e.pitches);
      const avg = all.reduce((a, b) => a + b, 0) / all.length;
      const up = avg < 4;
      const first = g[0];
      const last = g[g.length - 1];
      const fx = stemX(first.x, s, up);
      const lx = stemX(last.x, s, up);
      const extreme = up ? Math.max(...all) : Math.min(...all);
      const baseY = pitchY(bottom, extreme, s) + (up ? -3.3 * s : 3.3 * s);
      const slope = Math.max(-1, Math.min(1, ((last.e.pitches[0] - first.e.pitches[0]) * 0.5) / 2)) * s;
      const y1 = baseY + slope / 2;
      const y2 = baseY - slope / 2;
      const beamAt = (bx: number) => y1 + ((bx - fx) / Math.max(1, lx - fx)) * (y2 - y1);
      for (const pl of g) {
        const sx = stemX(pl.x, s, up);
        const ps = pl.e.pitches;
        const yStart = pitchY(bottom, up ? Math.min(...ps) : Math.max(...ps), s);
        stem(ctx, sx, yStart, beamAt(sx) + (up ? 0 : 0.48 * s), s);
      }
      const off = up ? 0 : -0.48 * s;
      beam(ctx, fx - 0.06 * s, y1 + off, lx + 0.06 * s, y2 + off, s);
      if (g.some((pl) => pl.e.flagCount > 1)) {
        const d = up ? 0.8 * s : -0.8 * s;
        beam(ctx, fx - 0.06 * s, y1 + off + d, lx + 0.06 * s, y2 + off + d, s);
      }
      if (rng() < 0.3) {
        const above = !up;
        const yA = pitchY(bottom, first.e.pitches[0], s) + (above ? -1.2 * s : 1.2 * s);
        const yB = pitchY(bottom, last.e.pitches[0], s) + (above ? -1.2 * s : 1.2 * s);
        slur(ctx, first.x, yA, last.x, yB, s, above);
      }
    }
    // Occasional tie/slur between non-beamed notes.
    if (placed.length >= 2 && rng() < 0.18) {
      const a = placed[0];
      const b = placed[placed.length - 1];
      if (a.e.kind === "note" && b.e.kind === "note") {
        slur(ctx, a.x, pitchY(bottom, a.e.pitches[0], s) + 1.1 * s, b.x, pitchY(bottom, b.e.pitches[0], s) + 1.1 * s, s, false);
      }
    }

    // Bar line.
    ctx.fillRect(barEnd - 0.07 * s, top, 0.14 * s, 4 * s);
    x = barEnd;
  }
};

const KEY_FLATS_TREBLE = [4, 7, 3, 6];
const KEY_FLATS_BASS = [2, 5, 1, 4];

const drawAgedPaper = (ctx: CanvasRenderingContext2D, rng: Rng, w: number, h: number) => {
  ctx.fillStyle = "#e8d3a6";
  ctx.fillRect(0, 0, w, h);
  // Low frequency mottling.
  for (let i = 0; i < 520; i++) {
    const x = rng() * w;
    const y = rng() * h;
    const r = range(rng, 80, 900);
    const dark = rng() < 0.62;
    const g = ctx.createRadialGradient(x, y, 0, x, y, r);
    const a = range(rng, 0.03, dark ? 0.12 : 0.08);
    g.addColorStop(0, dark ? `rgba(140, 92, 38, ${a})` : `rgba(255, 244, 214, ${a})`);
    g.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = g;
    ctx.fillRect(x - r, y - r, r * 2, r * 2);
  }
  // Water stains with darker rims.
  for (let i = 0; i < 26; i++) {
    const x = rng() * w;
    const y = rng() * h;
    const r = range(rng, 60, 320);
    const g = ctx.createRadialGradient(x, y, r * 0.6, x, y, r);
    g.addColorStop(0, "rgba(150, 100, 40, 0.02)");
    g.addColorStop(0.85, `rgba(120, 72, 22, ${range(rng, 0.05, 0.14)})`);
    g.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.ellipse(x, y, r, r * range(rng, 0.6, 1), rng() * Math.PI, 0, Math.PI * 2);
    ctx.fill();
  }
  // Multi-scale blotchy noise: tiny random canvases upscaled with smoothing.
  for (const [cw, alpha] of [[24, 0.22], [70, 0.16], [220, 0.12], [900, 0.1]] as const) {
    const ch = Math.round((cw * h) / w);
    const nc = document.createElement("canvas");
    nc.width = cw;
    nc.height = ch;
    const nctx = nc.getContext("2d")!;
    const img = nctx.createImageData(cw, ch);
    for (let i = 0; i < cw * ch; i++) {
      const v = rng();
      img.data[i * 4] = 120 + v * 135;
      img.data[i * 4 + 1] = 80 + v * 160;
      img.data[i * 4 + 2] = 30 + v * 190;
      img.data[i * 4 + 3] = 255;
    }
    nctx.putImageData(img, 0, 0);
    ctx.save();
    ctx.globalCompositeOperation = "multiply";
    ctx.globalAlpha = alpha;
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(nc, 0, 0, w, h);
    ctx.restore();
  }
  // Speckles and fibres.
  for (let i = 0; i < 9000; i++) {
    ctx.fillStyle = `rgba(${rng() < 0.5 ? "90,55,20" : "255,250,230"}, ${range(rng, 0.05, 0.3)})`;
    const r = range(rng, 0.6, rng() < 0.03 ? 6 : 2.2);
    ctx.beginPath();
    ctx.arc(rng() * w, rng() * h, r, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.strokeStyle = "rgba(110, 70, 30, 0.07)";
  ctx.lineWidth = 1.4;
  for (let i = 0; i < 1400; i++) {
    const x = rng() * w;
    const y = rng() * h;
    const a = rng() * Math.PI;
    const l = range(rng, 8, 40);
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.quadraticCurveTo(x + Math.cos(a) * l * 0.5 + range(rng, -4, 4), y + Math.sin(a) * l * 0.5, x + Math.cos(a) * l, y + Math.sin(a) * l);
    ctx.stroke();
  }
};

// Builds the full engraved, aged score page.
export const buildScoreCanvas = (seed: number): HTMLCanvasElement => {
  const canvas = document.createElement("canvas");
  canvas.width = SCORE_W;
  canvas.height = SCORE_H;
  const ctx = canvas.getContext("2d")!;
  const rng = mulberry32(seed);
  const s = STAFF_SPACE;
  drawAgedPaper(ctx, rng, SCORE_W, SCORE_H);

  ctx.fillStyle = INK;
  const left = 40 * s;
  const right = SCORE_W - 2 * s;
  for (let top = FIRST_SYSTEM_Y * s; top + 14 * s < SCORE_H; top += SYSTEM_GAP * s) {
    const bassTop = top + 9.5 * s;
    staffLines(ctx, left, right, top, s);
    staffLines(ctx, left, right, bassTop, s);
    brace(ctx, left - 1.6 * s, top, bassTop + 4 * s, s);
    ctx.fillRect(left - 0.1 * s, top, 0.2 * s, bassTop + 4 * s - top);
    trebleClef(ctx, left + 0.8 * s, top + 4 * s, s);
    bassClef(ctx, left + 0.8 * s, bassTop + 4 * s, s);
    KEY_FLATS_TREBLE.forEach((p, i) => flat(ctx, left + 4.4 * s + i * 1.1 * s, top + 4 * s - (p * s) / 2, s));
    KEY_FLATS_BASS.forEach((p, i) => flat(ctx, left + 4.4 * s + i * 1.1 * s, bassTop + 4 * s - (p * s) / 2, s));
    const musicStart = left + 9.5 * s;
    drawStaffMusic(ctx, rng, musicStart, right, top, s);
    drawStaffMusic(ctx, rng, musicStart, right, bassTop, s);
  }

  // Aging pass over the ink: ink fading blotches and foxing.
  ctx.globalCompositeOperation = "source-over";
  for (let i = 0; i < 160; i++) {
    const x = rng() * SCORE_W;
    const y = rng() * SCORE_H;
    const r = range(rng, 40, 260);
    const g = ctx.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, `rgba(232, 211, 166, ${range(rng, 0.08, 0.3)})`);
    g.addColorStop(1, "rgba(232, 211, 166, 0)");
    ctx.fillStyle = g;
    ctx.fillRect(x - r, y - r, r * 2, r * 2);
  }
  ctx.globalCompositeOperation = "multiply";
  for (let i = 0; i < 70; i++) {
    const x = rng() * SCORE_W;
    const y = rng() * SCORE_H;
    const r = range(rng, 10, 70);
    const g = ctx.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, `rgba(160, 105, 50, ${range(rng, 0.2, 0.5)})`);
    g.addColorStop(1, "rgba(255,255,255,0)");
    ctx.fillStyle = g;
    ctx.fillRect(x - r, y - r, r * 2, r * 2);
  }
  ctx.globalCompositeOperation = "source-over";
  return canvas;
};

// Sparse "double exposure" layer: faint staff fragments and small floating notes
// on transparent background, sampled in screen space by the shader.
export const buildGhostCanvas = (seed: number): HTMLCanvasElement => {
  const w = 2048;
  const h = 1024;
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d")!;
  const rng = mulberry32(seed);
  ctx.fillStyle = "rgba(255,255,255,0)";
  ctx.fillRect(0, 0, w, h);
  ctx.fillStyle = "rgba(0,0,0,1)";
  // Faint grid of thin rules.
  ctx.fillStyle = "rgba(0,0,0,0.4)";
  for (let x = 0; x < w; x += 256) ctx.fillRect(x + range(rng, -20, 20), 0, 2, h);
  for (let y = 0; y < h; y += 220) ctx.fillRect(0, y + range(rng, -20, 20), w, 2);
  // Small floating notes.
  ctx.fillStyle = "rgba(0,0,0,1)";
  for (let i = 0; i < 46; i++) {
    const s = range(rng, 6, 11);
    const x = rng() * w;
    const y = rng() * h;
    const up = rng() < 0.75;
    noteHead(ctx, x, y, s, true);
    const sx = stemX(x, s, up);
    const tip = up ? y - 3.4 * s : y + 3.4 * s;
    stem(ctx, sx, y, tip, s);
    if (rng() < 0.7) flags(ctx, sx, tip, s, up, rng() < 0.3 ? 2 : 1);
  }
  return canvas;
};
