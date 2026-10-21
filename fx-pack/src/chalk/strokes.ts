/**
 * Chalk strokes: polylines with a per-point width, in 4K pixels. Formulas are
 * laid out from Tegaki's stroke-order data for Caveat (handwriting font, OFL),
 * so each glyph can be written on stroke by stroke.
 */
import glyphJSON from "./data/caveat-strokes.json";
import { mulberry32 } from "../lib/random";

export type Pt = [number, number, number]; // x, y, width
export type Stroke = { pts: Pt[]; kind: "ink" | "hatch" };

type GlyphStroke = { p: number[][]; d: number; a: number };
type Glyph = { w: number; s: GlyphStroke[] };
const GLYPHS = glyphJSON as unknown as Record<string, Glyph>;

const EM = 1000;
const STROKE_W = 58; // mean Caveat stroke width (font units)

/** Hand-made glyphs for characters the font data lacks (font units, y up = negative). */
const CUSTOM: Record<string, Glyph> = {
  // π: top bar, left leg, right leg with a small foot
  "π": {
    w: 560,
    s: [
      { p: [[70, -400], [200, -425], [360, -432], [520, -440]], d: 0, a: 0 },
      { p: [[205, -428], [196, -300], [180, -170], [150, -50]], d: 0, a: 0 },
      { p: [[380, -432], [384, -300], [392, -150], [415, -70], [470, -55]], d: 0, a: 0 },
    ],
  },
  "±": {
    w: 470,
    s: [
      { p: [[240, -500], [244, -380], [246, -230]], d: 0, a: 0 },
      { p: [[110, -360], [250, -366], [385, -372]], d: 0, a: 0 },
      { p: [[110, -110], [250, -116], [390, -120]], d: 0, a: 0 },
    ],
  },
  "−": { w: 380, s: [{ p: [[60, -250], [190, -254], [320, -258]], d: 0, a: 0 }] },
  "°": {
    w: 320,
    s: [
      {
        p: Array.from({ length: 13 }, (_, i) => {
          const a = (i / 12) * Math.PI * 2 - 1.2;
          return [200 + Math.cos(a) * 85, -620 + Math.sin(a) * 85];
        }),
        d: 0,
        a: 0,
      },
    ],
  },
  "·": { w: 160, s: [{ p: [[80, -250], [81, -250]], d: 0, a: 0 }] },
};

const glyphFor = (ch: string): Glyph | null => {
  if (CUSTOM[ch]) return CUSTOM[ch];
  if (ch === "…") return null;
  return GLYPHS[ch] ?? null;
};

export type Box = { strokes: Stroke[]; w: number; asc: number; desc: number };

const emptyBox = (): Box => ({ strokes: [], w: 0, asc: 0, desc: 0 });

/** Shift a box's strokes. */
const offset = (strokes: Stroke[], dx: number, dy: number): Stroke[] =>
  strokes.map((s) => ({ ...s, pts: s.pts.map(([x, y, w]) => [x + dx, y + dy, w] as Pt) }));

/** Plain text at a font size (px). Baseline at y = 0. */
export const textBox = (str: string, size: number): Box => {
  const s = size / EM;
  // each glyph instance gets its own small size/slant/baseline wobble, like a hand
  let seed = 0;
  for (const ch of str) seed = (seed * 31 + ch.charCodeAt(0)) | 0;
  const hand = mulberry32(seed ^ Math.round(size * 7));
  const box = emptyBox();
  let x = 0;
  const chars = [...str.replace(/…/g, "...")];
  for (const ch of chars) {
    if (ch === " ") {
      x += 0.22 * size;
      continue;
    }
    const g = glyphFor(ch);
    if (!g) {
      x += 0.3 * size;
      continue;
    }
    const gs = s * (0.93 + 0.14 * hand());
    const slant = (hand() - 0.5) * 0.12;
    const dy = (hand() - 0.5) * 0.05 * size;
    for (const st of g.s) {
      box.strokes.push({
        kind: "ink",
        pts: st.p.map((p) => [x + p[0] * gs - p[1] * gs * slant, p[1] * gs + dy, (p[2] ?? STROKE_W) * s] as Pt),
      });
    }
    x += g.w * s * 0.96;
  }
  box.w = x;
  box.asc = 0.66 * size;
  box.desc = 0.12 * size;
  return box;
};

// ---------------------------------------------------------------------------
// Formula DSL: strings, plus {sup}, {sub}, {sqrt}, {frac} groups.
// ---------------------------------------------------------------------------
export type Tok =
  | string
  | { sup: Tok[] | string }
  | { sub: Tok[] | string }
  | { sqrt: Tok[] | string }
  | { frac: [Tok[] | string, Tok[] | string] };

const toks = (t: Tok[] | string): Tok[] => (typeof t === "string" ? [t] : t);

const line = (pts: [number, number][], w: number): Stroke => ({
  kind: "ink",
  pts: pts.map(([x, y]) => [x, y, w] as Pt),
});

export const layoutFormula = (tokens: Tok[], size: number): Box => {
  const out = emptyBox();
  out.asc = 0.66 * size;
  out.desc = 0.12 * size;
  let x = 0;
  const lw = (STROKE_W / EM) * size;
  for (const t of tokens) {
    let b: Box;
    let dy = 0;
    if (typeof t === "string") {
      b = textBox(t, size);
    } else if ("sup" in t) {
      b = layoutFormula(toks(t.sup), size * 0.58);
      dy = -0.36 * size;
      x -= 0.02 * size;
    } else if ("sub" in t) {
      b = layoutFormula(toks(t.sub), size * 0.58);
      dy = 0.14 * size;
    } else if ("sqrt" in t) {
      const inner = layoutFormula(toks(t.sqrt), size);
      const top = -inner.asc - 0.12 * size;
      const bot = inner.desc + 0.02 * size;
      const hx = 0.42 * size;
      const radical = line(
        [
          [0, -0.3 * size],
          [0.08 * size, -0.36 * size],
          [0.2 * size, bot * 0.6],
          [0.26 * size, bot],
          [0.33 * size, (top + bot) * 0.5],
          [hx - 0.04 * size, top + 0.02 * size],
          [hx, top],
        ],
        lw,
      );
      const bar = line(
        [
          [hx, top],
          [hx + (inner.w + 0.1 * size) * 0.5, top - 0.01 * size],
          [hx + inner.w + 0.1 * size, top + 0.01 * size],
        ],
        lw * 0.95,
      );
      b = {
        strokes: [radical, ...offset(inner.strokes, hx + 0.05 * size, 0), bar], // bar drawn after its contents, as by hand
        w: hx + inner.w + 0.14 * size,
        asc: -top + 0.04 * size,
        desc: bot,
      };
    } else {
      const fs = size * 0.86;
      const num = layoutFormula(toks(t.frac[0]), fs);
      const den = layoutFormula(toks(t.frac[1]), fs);
      const w = Math.max(num.w, den.w) + 0.2 * size;
      const barY = -0.27 * size;
      const bar = line(
        [
          [0, barY],
          [w * 0.5, barY - 0.01 * size],
          [w, barY + 0.005 * size],
        ],
        lw,
      );
      b = {
        strokes: [
          ...offset(num.strokes, (w - num.w) / 2, barY - num.desc - 0.1 * size),
          bar,
          ...offset(den.strokes, (w - den.w) / 2, barY + den.asc + 0.1 * size),
        ],
        w,
        asc: -barY + num.desc + num.asc + 0.1 * size,
        desc: barY + den.asc + den.desc + 0.1 * size,
      };
      x += 0.06 * size;
      out.strokes.push(...offset(b.strokes, x, 0));
      x += b.w + 0.06 * size;
      out.asc = Math.max(out.asc, b.asc);
      out.desc = Math.max(out.desc, b.desc);
      continue;
    }
    out.strokes.push(...offset(b.strokes, x, dy));
    out.asc = Math.max(out.asc, b.asc - dy);
    out.desc = Math.max(out.desc, b.desc + dy);
    x += b.w;
  }
  out.w = x;
  return out;
};

/** Normalise a box so its top-left is at (0, 0). */
export const toCard = (b: Box) => ({
  strokes: offset(b.strokes, 0, b.asc),
  w: b.w,
  h: b.asc + b.desc,
});

export const strokeLength = (s: Stroke) => {
  let L = 0;
  for (let i = 1; i < s.pts.length; i++) {
    L += Math.hypot(s.pts[i][0] - s.pts[i - 1][0], s.pts[i][1] - s.pts[i - 1][1]);
  }
  return L;
};
