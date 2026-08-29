import { makeCodeLines, makeEquationRow, makeWallLine, type EqAtom } from "./content";
import { pick, rndInt, rndRange } from "./seed";
import {
  WALL_BLOCK_HEIGHT,
  WALL_BLOCK_LINES,
  WALL_LINE_HEIGHT,
} from "./constants";
import type { DiagramSet, Palette } from "./variants";

export const createCanvas = (w: number, h: number): HTMLCanvasElement => {
  const c = document.createElement("canvas");
  c.width = Math.max(1, Math.round(w));
  c.height = Math.max(1, Math.round(h));
  return c;
};

const ctxOf = (c: HTMLCanvasElement): CanvasRenderingContext2D => {
  const ctx = c.getContext("2d");
  if (!ctx) throw new Error("2d context unavailable");
  return ctx;
};

/** #RRGGBB -> rgba(). Every hex reaching here came from the variant palette. */
export const withAlpha = (hex: string, alpha: number): string => {
  const n = parseInt(hex.slice(1), 16);
  const r = (n >> 16) & 255;
  const g = (n >> 8) & 255;
  const b = n & 255;
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
};

/* ------------------------------------------------------------------ */
/* Code blocks. */

export type CodeBlockSpec = {
  seed: string;
  lineCount: number;
  fontSize: number;
  dense: boolean;
  /** Lines replaced this frame by a live re-render event: index -> text. */
  overrides: Record<number, string>;
};

export const buildCodeBlockSprite = (
  spec: CodeBlockSpec,
  palette: Palette,
  fontFamily: string,
): HTMLCanvasElement => {
  const lines = makeCodeLines(spec.seed, spec.lineCount, spec.dense);
  for (const key of Object.keys(spec.overrides)) {
    const i = Number(key);
    if (i >= 0 && i < lines.length) lines[i] = spec.overrides[i];
  }
  const fs = spec.fontSize;
  const lh = Math.round(fs * 1.42);
  const pad = Math.round(fs * 0.9);
  const charW = fs * 0.6;
  let maxLen = 1;
  for (const l of lines) maxLen = Math.max(maxLen, l.length);
  const w = Math.min(880, maxLen * charW + pad * 2);
  const h = lines.length * lh + pad * 2;
  const canvas = createCanvas(w, h);
  const ctx = ctxOf(canvas);
  ctx.font = `${fs}px ${fontFamily}`;
  ctx.textBaseline = "top";

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (!line) continue;
    const s = `${spec.seed}:line:${i}`;
    const bright = rndRange(s + "b", 0, 1);
    const overridden = spec.overrides[i] !== undefined;
    const colour = overridden || bright > 0.9 ? palette.textPale : palette.textMain;
    const alpha = overridden ? 1 : 0.45 + bright * 0.5;
    ctx.fillStyle = withAlpha(colour, alpha);
    ctx.fillText(line, pad, pad + i * lh, w - pad * 2);
  }
  return canvas;
};

/* ------------------------------------------------------------------ */
/* Equation fragments. */

const drawAtom = (
  ctx: CanvasRenderingContext2D,
  atom: EqAtom,
  x: number,
  baseline: number,
  fs: number,
  colour: string,
): number => {
  const charW = fs * 0.6;
  ctx.fillStyle = colour;
  ctx.strokeStyle = colour;
  ctx.lineWidth = Math.max(1.2, fs * 0.06);
  ctx.lineCap = "round";
  switch (atom.kind) {
    case "op": {
      ctx.font = `${fs}px monospace`;
      ctx.fillText(atom.text, x, baseline);
      return charW * (atom.text.length + 1);
    }
    case "sym": {
      ctx.font = `italic ${fs}px serif`;
      ctx.fillText(atom.text, x, baseline);
      let adv = charW * 1.05;
      if (atom.sub) {
        ctx.font = `italic ${fs * 0.6}px serif`;
        ctx.fillText(atom.sub, x + adv, baseline + fs * 0.18);
        adv += charW * 0.6 * atom.sub.length;
      }
      if (atom.sup) {
        ctx.font = `${fs * 0.6}px serif`;
        ctx.fillText(atom.sup, x + adv, baseline - fs * 0.5);
        adv += charW * 0.55;
      }
      return adv + charW * 0.3;
    }
    case "frac": {
      const fsS = fs * 0.68;
      ctx.font = `italic ${fsS}px serif`;
      const wTop = ctx.measureText(atom.top).width;
      const wBot = ctx.measureText(atom.bottom).width;
      const w = Math.max(wTop, wBot);
      ctx.fillText(atom.top, x + (w - wTop) / 2, baseline - fs * 0.32);
      ctx.fillText(atom.bottom, x + (w - wBot) / 2, baseline + fs * 0.62);
      ctx.beginPath();
      ctx.moveTo(x, baseline + fs * 0.06);
      ctx.lineTo(x + w, baseline + fs * 0.06);
      ctx.stroke();
      return w + charW * 0.6;
    }
    case "sum": {
      // A drawn sigma, so the fragment never depends on the face's coverage.
      const h = fs * 1.05;
      const w = fs * 0.72;
      const top = baseline - h * 0.72;
      ctx.beginPath();
      ctx.moveTo(x + w, top);
      ctx.lineTo(x, top);
      ctx.lineTo(x + w * 0.62, top + h / 2);
      ctx.lineTo(x, top + h);
      ctx.lineTo(x + w, top + h);
      ctx.stroke();
      return w + charW;
    }
    case "integral": {
      const h = fs * 1.35;
      const top = baseline - h * 0.78;
      ctx.beginPath();
      ctx.moveTo(x + fs * 0.34, top);
      ctx.bezierCurveTo(
        x + fs * 0.02, top + h * 0.08,
        x + fs * 0.42, top + h * 0.42,
        x + fs * 0.2, top + h * 0.92,
      );
      ctx.stroke();
      return fs * 0.62 + charW * 0.4;
    }
    case "sqrt": {
      const fsS = fs * 0.82;
      ctx.font = `italic ${fsS}px serif`;
      const w = ctx.measureText(atom.text).width;
      const h = fs * 0.95;
      ctx.beginPath();
      ctx.moveTo(x, baseline - h * 0.28);
      ctx.lineTo(x + fs * 0.18, baseline + fs * 0.16);
      ctx.lineTo(x + fs * 0.34, baseline - h * 0.78);
      ctx.lineTo(x + fs * 0.34 + w + fs * 0.2, baseline - h * 0.78);
      ctx.stroke();
      ctx.fillText(atom.text, x + fs * 0.44, baseline);
      return w + fs * 0.8;
    }
    case "paren": {
      const fsS = fs * 0.9;
      ctx.font = `italic ${fsS}px serif`;
      const text = `(${atom.text})`;
      ctx.fillText(text, x, baseline);
      return ctx.measureText(text).width + charW * 0.4;
    }
    default:
      return charW;
  }
};

export type EquationSpec = {
  seed: string;
  rows: number;
  fontSize: number;
};

export const buildEquationSprite = (
  spec: EquationSpec,
  palette: Palette,
): HTMLCanvasElement => {
  const fs = spec.fontSize;
  const rowH = Math.round(fs * 2.1);
  const pad = Math.round(fs * 0.9);
  // Two passes: measure on a scratch context, then draw at the real size.
  const scratch = ctxOf(createCanvas(8, 8));
  scratch.textBaseline = "alphabetic";
  const rows: { atoms: EqAtom[]; width: number }[] = [];
  for (let r = 0; r < spec.rows; r++) {
    const atoms = makeEquationRow(`${spec.seed}:row:${r}`);
    let x = 0;
    for (const a of atoms) x += drawAtom(scratch, a, x, 0, fs, "rgba(0,0,0,0)");
    rows.push({ atoms, width: x });
  }
  const w = Math.min(880, Math.max(...rows.map((r) => r.width)) + pad * 2);
  const h = rows.length * rowH + pad * 2;
  const canvas = createCanvas(w, h);
  const ctx = ctxOf(canvas);
  ctx.textBaseline = "alphabetic";
  for (let r = 0; r < rows.length; r++) {
    const bright = rndRange(`${spec.seed}:b:${r}`, 0, 1);
    const colour = bright > 0.82 ? palette.textPale : palette.textMain;
    const alpha = 0.5 + bright * 0.45;
    let x = pad;
    const baseline = pad + r * rowH + rowH * 0.62;
    for (const a of rows[r].atoms) {
      x += drawAtom(ctx, a, x, baseline, fs, withAlpha(colour, alpha));
    }
  }
  return canvas;
};

/* ------------------------------------------------------------------ */
/* Diagram glyphs. */

const node = (ctx: CanvasRenderingContext2D, x: number, y: number, r: number, filled: boolean) => {
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  if (filled) ctx.fill();
  else ctx.stroke();
};

const poly = (ctx: CanvasRenderingContext2D, pts: number[][], close: boolean) => {
  ctx.beginPath();
  ctx.moveTo(pts[0][0], pts[0][1]);
  for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]);
  if (close) ctx.closePath();
  ctx.stroke();
};

const MOLECULES = ["hexRing", "branchedChain", "tetrahedral", "fusedRings", "bondPair"] as const;
const CIRCUITS = ["resistor", "capacitor", "junction", "ground", "inductor", "transistor"] as const;

export type DiagramSpec = {
  seed: string;
  set: DiagramSet;
  /** Half-size of the sprite's drawable area, in 4K pixels. */
  size: number;
};

const drawMolecule = (
  ctx: CanvasRenderingContext2D,
  kind: (typeof MOLECULES)[number],
  s: number,
  seed: string,
  nodeR: number,
) => {
  const hex = (cx: number, cy: number, r: number) => {
    const pts: number[][] = [];
    for (let i = 0; i < 6; i++) {
      const a = (Math.PI / 3) * i - Math.PI / 6;
      pts.push([cx + Math.cos(a) * r, cy + Math.sin(a) * r]);
    }
    poly(ctx, pts, true);
    for (const p of pts) node(ctx, p[0], p[1], nodeR, false);
    return pts;
  };
  switch (kind) {
    case "hexRing": {
      const pts = hex(0, 0, s * 0.7);
      // An inner line on two edges reads as a double bond.
      ctx.beginPath();
      for (let i = 0; i < 6; i += 2) {
        const a = pts[i];
        const b = pts[(i + 1) % 6];
        const mx = (a[0] + b[0]) * 0.5;
        const my = (a[1] + b[1]) * 0.5;
        const k = 0.72;
        ctx.moveTo(mx + (a[0] - mx) * k * 0.8, my + (a[1] - my) * k * 0.8);
        ctx.lineTo(mx + (b[0] - mx) * k * 0.8, my + (b[1] - my) * k * 0.8);
      }
      ctx.save();
      ctx.globalAlpha *= 0.7;
      ctx.stroke();
      ctx.restore();
      break;
    }
    case "branchedChain": {
      const n = rndInt(seed + "n", 4, 7);
      let x = -s * 0.8;
      let y = rndRange(seed + "y", -s * 0.3, s * 0.3);
      const pts: number[][] = [[x, y]];
      for (let i = 1; i < n; i++) {
        x += (s * 1.6) / (n - 1);
        y = rndRange(`${seed}:y${i}`, -s * 0.55, s * 0.55);
        pts.push([x, y]);
      }
      poly(ctx, pts, false);
      // A branch off one of the middle vertices.
      const bi = rndInt(seed + "b", 1, Math.max(2, n - 1));
      const bx = pts[bi][0] + rndRange(seed + "bx", -s * 0.2, s * 0.2);
      const by = pts[bi][1] + (rndRange(seed + "bs", 0, 1) < 0.5 ? -1 : 1) * s * 0.6;
      poly(ctx, [pts[bi], [bx, by]], false);
      node(ctx, bx, by, nodeR, false);
      for (const p of pts) node(ctx, p[0], p[1], nodeR, false);
      break;
    }
    case "tetrahedral": {
      const base = rndRange(seed + "r", 0, Math.PI);
      for (let i = 0; i < 4; i++) {
        const a = base + (Math.PI / 2) * i + rndRange(`${seed}:a${i}`, -0.25, 0.25);
        const r = s * rndRange(`${seed}:l${i}`, 0.6, 0.95);
        const x = Math.cos(a) * r;
        const y = Math.sin(a) * r;
        poly(ctx, [[0, 0], [x, y]], false);
        node(ctx, x, y, nodeR, false);
      }
      node(ctx, 0, 0, nodeR * 1.35, true);
      break;
    }
    case "fusedRings": {
      const r = s * 0.55;
      hex(-r * 0.87, 0, r);
      hex(r * 0.87, 0, r);
      break;
    }
    case "bondPair":
    default: {
      const a = rndRange(seed + "a", 0, Math.PI);
      const x = Math.cos(a) * s * 0.75;
      const y = Math.sin(a) * s * 0.75;
      poly(ctx, [[-x, -y], [x, y]], false);
      node(ctx, -x, -y, nodeR, false);
      node(ctx, x, y, nodeR, false);
      break;
    }
  }
};

const drawCircuit = (
  ctx: CanvasRenderingContext2D,
  kind: (typeof CIRCUITS)[number],
  s: number,
  seed: string,
  nodeR: number,
) => {
  const lead = s * 0.42;
  switch (kind) {
    case "resistor": {
      const zig: number[][] = [[-s, 0], [-lead, 0]];
      const teeth = 6;
      for (let i = 0; i < teeth; i++) {
        const x = -lead + ((2 * lead) / teeth) * (i + 0.5);
        zig.push([x, i % 2 === 0 ? -s * 0.32 : s * 0.32]);
      }
      zig.push([lead, 0], [s, 0]);
      poly(ctx, zig, false);
      node(ctx, -s, 0, nodeR, false);
      node(ctx, s, 0, nodeR, false);
      break;
    }
    case "capacitor": {
      poly(ctx, [[-s, 0], [-s * 0.16, 0]], false);
      poly(ctx, [[s * 0.16, 0], [s, 0]], false);
      poly(ctx, [[-s * 0.16, -s * 0.5], [-s * 0.16, s * 0.5]], false);
      poly(ctx, [[s * 0.16, -s * 0.5], [s * 0.16, s * 0.5]], false);
      node(ctx, -s, 0, nodeR, false);
      node(ctx, s, 0, nodeR, false);
      break;
    }
    case "junction": {
      const n = rndInt(seed + "n", 3, 5);
      for (let i = 0; i < n; i++) {
        // Orthogonal legs: circuits are angular where molecules are radial.
        const a = (Math.PI / 2) * i + (n === 3 && i === 2 ? Math.PI / 2 : 0);
        const len = s * rndRange(`${seed}:l${i}`, 0.6, 1);
        const x = Math.round(Math.cos(a)) * len;
        const y = Math.round(Math.sin(a)) * len;
        poly(ctx, [[0, 0], [x, y]], false);
        node(ctx, x, y, nodeR, false);
      }
      node(ctx, 0, 0, nodeR * 1.4, true);
      break;
    }
    case "ground": {
      poly(ctx, [[0, -s], [0, 0]], false);
      for (let i = 0; i < 3; i++) {
        const w = s * (0.62 - i * 0.19);
        const y = i * s * 0.26;
        poly(ctx, [[-w, y], [w, y]], false);
      }
      node(ctx, 0, -s, nodeR, false);
      break;
    }
    case "inductor": {
      poly(ctx, [[-s, 0], [-s * 0.6, 0]], false);
      ctx.beginPath();
      const arcs = 4;
      const r = (s * 1.2) / (arcs * 2);
      for (let i = 0; i < arcs; i++) {
        const cx = -s * 0.6 + r * (2 * i + 1);
        ctx.moveTo(cx - r, 0);
        ctx.arc(cx, 0, r, Math.PI, 0, false);
      }
      ctx.stroke();
      poly(ctx, [[s * 0.6, 0], [s, 0]], false);
      node(ctx, -s, 0, nodeR, false);
      node(ctx, s, 0, nodeR, false);
      break;
    }
    case "transistor":
    default: {
      poly(ctx, [[-s, 0], [-s * 0.3, 0]], false);
      poly(ctx, [[-s * 0.3, -s * 0.55], [-s * 0.3, s * 0.55]], false);
      poly(ctx, [[-s * 0.3, -s * 0.3], [s * 0.65, -s * 0.8]], false);
      poly(ctx, [[-s * 0.3, s * 0.3], [s * 0.65, s * 0.8]], false);
      node(ctx, -s, 0, nodeR, false);
      node(ctx, s * 0.65, -s * 0.8, nodeR, false);
      node(ctx, s * 0.65, s * 0.8, nodeR, false);
      break;
    }
  }
};

export const buildDiagramSprite = (
  spec: DiagramSpec,
  palette: Palette,
): HTMLCanvasElement => {
  const s = spec.size;
  const padded = s * 1.5 + 12;
  const canvas = createCanvas(padded * 2, padded * 2);
  const ctx = ctxOf(canvas);
  ctx.translate(padded, padded);
  ctx.strokeStyle = palette.diagram;
  ctx.fillStyle = palette.diagram;
  ctx.lineWidth = Math.max(1.6, s * 0.028);
  ctx.lineJoin = "round";
  ctx.lineCap = "round";
  const nodeR = Math.max(2.6, s * 0.055);
  if (spec.set === "molecules") {
    drawMolecule(ctx, pick(spec.seed + "kind", MOLECULES), s, spec.seed, nodeR);
  } else {
    drawCircuit(ctx, pick(spec.seed + "kind", CIRCUITS), s, spec.seed, nodeR);
  }
  return canvas;
};

/* ------------------------------------------------------------------ */
/* Node dot halo. One sprite per colour, blitted at whatever size is needed. */

export const buildHaloSprite = (colour: string): HTMLCanvasElement => {
  const size = 128;
  const canvas = createCanvas(size, size);
  const ctx = ctxOf(canvas);
  const g = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  g.addColorStop(0, withAlpha(colour, 1));
  g.addColorStop(0.14, withAlpha(colour, 0.85));
  g.addColorStop(0.36, withAlpha(colour, 0.24));
  g.addColorStop(1, withAlpha(colour, 0));
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, size, size);
  return canvas;
};

/* ------------------------------------------------------------------ */
/* The text wall — one vertically tiling block of dense monospace. */

export const buildWallSprite = (
  seed: string,
  width: number,
  palette: Palette,
  fontFamily: string,
): HTMLCanvasElement => {
  const canvas = createCanvas(width, WALL_BLOCK_HEIGHT);
  const ctx = ctxOf(canvas);
  const fs = Math.round(WALL_LINE_HEIGHT * 0.78);
  ctx.font = `${fs}px ${fontFamily}`;
  ctx.textBaseline = "top";
  for (let i = 0; i < WALL_BLOCK_LINES; i++) {
    const s = `${seed}:wall:${i}`;
    const text = makeWallLine(s);
    const bright = rndRange(s + "b", 0, 1);
    let colour: string;
    let alpha: number;
    if (bright > 0.93) {
      colour = palette.textPale;
      alpha = 0.95;
    } else if (bright > 0.72) {
      colour = palette.structureMain;
      alpha = 0.8;
    } else {
      colour = palette.structureDim;
      alpha = 0.55 + bright * 0.5;
    }
    ctx.fillStyle = withAlpha(colour, alpha);
    const x = rndRange(s + "x", -40, 60);
    ctx.fillText(text, x, i * WALL_LINE_HEIGHT);
    // The wall is one continuous surface: repeat the line to the right edge
    // so it runs edge to edge with a ragged join rather than a hard end.
    const w = ctx.measureText(text).width;
    let cursor = x + w + fs * 2;
    let rep = 0;
    while (cursor < width) {
      const t2 = makeWallLine(`${s}:r${rep}`);
      ctx.fillText(t2, cursor, i * WALL_LINE_HEIGHT);
      cursor += ctx.measureText(t2).width + fs * rndRange(`${s}:g${rep}`, 1.5, 5);
      rep++;
    }
  }
  return canvas;
};

/* ------------------------------------------------------------------ */
/* Grain. */

export const buildGrainTiles = (count: number, size: number): HTMLCanvasElement[] => {
  const tiles: HTMLCanvasElement[] = [];
  for (let t = 0; t < count; t++) {
    const canvas = createCanvas(size, size);
    const ctx = ctxOf(canvas);
    const img = ctx.createImageData(size, size);
    const data = img.data;
    for (let i = 0; i < size * size; i++) {
      const v = 128 + (rndRange(`grain:${t}:${i}`, -1, 1) * 90);
      data[i * 4] = v;
      data[i * 4 + 1] = v;
      data[i * 4 + 2] = v;
      data[i * 4 + 3] = 255;
    }
    ctx.putImageData(img, 0, 0);
    tiles.push(canvas);
  }
  return tiles;
};
