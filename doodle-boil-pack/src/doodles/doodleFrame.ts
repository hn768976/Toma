import { CHALK, CRAYON } from "../inks";
import { bboxOf, pressedEnds, Pt, samplePath, polyPath, smoothPath, Stroke, transformPts } from "../lib/geom";
import { chalkInk, crayonInk } from "../lib/ink";
import type { Layer } from "../lib/layer";
import { mulberry32, range } from "../lib/random";
import { roughFill } from "../lib/roughLines";
import { Doodle, texOffset } from "../lib/scene";
import { SPACING, variantsOf } from "./common";

// ---------- 1 and 2: a frame of ~40 doodles around all four edges ----------

type Mark = { ctrl: Pt[]; straight?: boolean };
type Shape = (rng: () => number) => Mark[];

const TAU = Math.PI * 2;

// Unit-size shapes, roughly inside [-0.5, 0.5].
const SHAPES: Record<string, Shape> = {
  squiggle: (rng) => {
    const waves = 2 + Math.floor(rng() * 2);
    const amp = range(rng, 0.13, 0.2);
    return [{ ctrl: Array.from({ length: waves * 4 + 1 }, (_, i) => [-0.5 + i / (waves * 4), amp * Math.sin((i * TAU) / 4)] as Pt) }];
  },
  zigzag: (rng) => {
    const teeth = 4 + Math.floor(rng() * 3);
    const amp = range(rng, 0.22, 0.3);
    return [
      {
        straight: true,
        ctrl: Array.from({ length: teeth * 2 + 1 }, (_, i) => [
          -0.5 + i / (teeth * 2) + range(rng, -0.02, 0.02),
          (i % 2 ? -amp : amp) * range(rng, 0.75, 1.1),
        ] as Pt),
      },
    ];
  },
  cloud: (rng) => {
    const bumps = 6 + Math.floor(rng() * 3);
    const pts: Pt[] = [];
    const N = bumps * 6;
    for (let i = 0; i <= N + 4; i++) {
      const a = (i / N) * TAU;
      const r = 0.3 + 0.14 * Math.abs(Math.sin((a * bumps) / 2));
      pts.push([r * Math.cos(a) * 1.15, r * Math.sin(a) * 0.85]);
    }
    return [{ ctrl: pts }];
  },
  star: (rng) => {
    const pts: Pt[] = [];
    const rot = rng() * TAU;
    for (let i = 0; i <= 11; i++) {
      const r = i % 2 ? 0.2 : 0.5;
      const a = rot + (i / 10) * TAU;
      pts.push([r * Math.cos(a), r * Math.sin(a)]);
    }
    return [{ straight: true, ctrl: pts }];
  },
  spiral: (rng) => {
    const turns = range(rng, 2.4, 3.1);
    const pts: Pt[] = [];
    for (let i = 0; i <= 60; i++) {
      const t = i / 60;
      const a = t * turns * TAU;
      const r = 0.04 + 0.44 * t;
      pts.push([r * Math.cos(a), r * Math.sin(a)]);
    }
    return [{ ctrl: pts }];
  },
  scribble: (rng) => {
    const ell: Pt[] = Array.from({ length: 24 }, (_, i) => [0.45 * Math.cos((i / 24) * TAU), 0.32 * Math.sin((i / 24) * TAU)] as Pt);
    const lines = roughFill(ell, { fillStyle: "zigzag", hachureGap: 0.11, hachureAngle: range(rng, -60, -30), roughness: 0.5, seed: Math.floor(rng() * 1e6) + 1 }, 0.1);
    return lines.map((ctrl) => ({ ctrl }));
  },
  dashes: (rng) => {
    const n = 4 + Math.floor(rng() * 3);
    const ang = range(rng, -0.4, 0.4);
    return Array.from({ length: n }, (_, i) => {
      const y = -0.4 + (0.8 * i) / (n - 1);
      const x0 = range(rng, -0.5, -0.1);
      const len = range(rng, 0.25, 0.55);
      const p: Pt[] = [
        [x0, y],
        [x0 + len, y + range(rng, -0.05, 0.05)],
      ];
      return { straight: true, ctrl: transformPts(p, 1, ang, 0, 0) };
    });
  },
  burst: (rng) => {
    const spikes = 7 + Math.floor(rng() * 3);
    const pts: Pt[] = [];
    for (let i = 0; i <= spikes * 2 + 1; i++) {
      const a = (i / (spikes * 2)) * TAU;
      const r = i % 2 ? range(rng, 0.25, 0.3) : range(rng, 0.44, 0.52);
      pts.push([r * Math.cos(a), r * Math.sin(a)]);
    }
    return [{ straight: true, ctrl: pts }];
  },
  coil: (rng) => {
    const loops = 3 + Math.floor(rng() * 2);
    const pts: Pt[] = [];
    const N = loops * 10;
    for (let i = 0; i <= N; i++) {
      const th = (i / N) * loops * TAU;
      pts.push([-0.42 + (0.84 * i) / N - 0.11 * Math.sin(th), 0.2 * Math.cos(th) - 0.05]);
    }
    return [{ ctrl: pts }];
  },
  boxes: (rng) => {
    const rr = (s: number): Pt[] => {
      const c = s * 0.35;
      const h = s;
      const pts: Pt[] = [];
      const corners: Pt[] = [
        [h - c, -h * 0.8],
        [h, -h * 0.8 + c],
        [h, h * 0.8 - c],
        [h - c, h * 0.8],
        [-h + c, h * 0.8],
        [-h, h * 0.8 - c],
        [-h, -h * 0.8 + c],
        [-h + c, -h * 0.8],
      ];
      for (let i = 0; i < 9; i++) pts.push(corners[i % 8]);
      pts.push([corners[0][0] + range(rng, 0, 0.05), corners[0][1]]);
      return pts;
    };
    return [{ ctrl: rr(0.48) }, { ctrl: rr(0.3) }];
  },
  petals: (rng) => {
    const n = 4 + Math.floor(rng() * 2);
    const base = rng() * TAU;
    const pts: Pt[] = [];
    for (let k = 0; k < n; k++) {
      const a = base + (k / n) * Math.PI * 0.9 - 0.7;
      const d: Pt = [Math.cos(a), Math.sin(a)];
      const nrm: Pt = [-d[1], d[0]];
      const w = 0.07;
      pts.push([-0.2 * d[0], -0.2 * d[1] + 0.15]);
      pts.push([0.5 * d[0] + nrm[0] * w, 0.5 * d[1] + nrm[1] * w + 0.15]);
      pts.push([0.55 * d[0] - nrm[0] * w, 0.55 * d[1] - nrm[1] * w + 0.15]);
    }
    pts.push([-0.2 * Math.cos(base), 0.15]);
    return [{ ctrl: pts }];
  },
  blob: (rng) => {
    const pts: Pt[] = [];
    const N = 14;
    const ph = rng() * TAU;
    for (let i = 0; i <= N + 2; i++) {
      const a = (i / N) * TAU;
      const r = 0.38 + 0.08 * Math.sin(3 * a + ph) + 0.05 * Math.sin(5 * a + 2 * ph);
      pts.push([r * Math.cos(a) * 1.2, r * Math.sin(a) * 0.8]);
    }
    return [{ ctrl: pts }];
  },
};

// Weighted toward the open outlines of the reference; spirals, stars and coils are accents.
const SHAPE_ORDER = [
  "squiggle", "squiggle", "zigzag", "zigzag", "cloud", "blob", "blob", "burst", "burst",
  "dashes", "dashes", "boxes", "scribble", "petals", "cloud", "squiggle", "zigzag", "blob",
  "coil", "spiral", "star",
];
// White and pink carry more of the frame, as in the reference.
const COLOURS = [...Object.values(CRAYON), CRAYON.white, CRAYON.pink];

const COUNT = 40;
const RECT = { x0: 190, x1: 3650, y0: 130, y1: 2030 };

/** Evenly spaced positions around the frame's centre line, clockwise from top-left. */
const perimeter = (n: number): { p: Pt; side: "h" | "v" }[] => {
  const w = RECT.x1 - RECT.x0;
  const h = RECT.y1 - RECT.y0;
  const total = 2 * (w + h);
  const out: { p: Pt; side: "h" | "v" }[] = [];
  for (let i = 0; i < n; i++) {
    let s = ((i + 0.5) / n) * total;
    if (s < w) out.push({ p: [RECT.x0 + s, RECT.y0], side: "h" });
    else if ((s -= w) < h) out.push({ p: [RECT.x1, RECT.y0 + s], side: "v" });
    else if ((s -= h) < w) out.push({ p: [RECT.x1 - s, RECT.y1], side: "h" });
    else out.push({ p: [RECT.x0, RECT.y1 - (s - w)], side: "v" });
  }
  return out;
};

type Placed = { strokes: Stroke[]; colour: string; center: Pt; size: number; phase: number; cycles: [number, number] };

// Layout is shared by the crayon and the chalk frame, so both are "the same frame".
const layout = (strokeSize: number): Placed[] => {
  const rng = mulberry32(0xd00d1e);
  // A shuffled deck of the shapes, so each appears 3-4 times and neighbours differ.
  const deck: string[] = [];
  while (deck.length < COUNT) {
    const round = [...SHAPE_ORDER];
    for (let i = round.length - 1; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1));
      [round[i], round[j]] = [round[j], round[i]];
    }
    if (deck.length && round[0] === deck[deck.length - 1]) round.push(round.shift()!);
    deck.push(...round);
  }
  const placed: Placed[] = [];
  let lastColour = -1;
  perimeter(COUNT).forEach(({ p, side }, i) => {
    const shape = deck[i];
    let ci = Math.floor(rng() * COLOURS.length);
    if (ci === lastColour) ci = (ci + 1 + Math.floor(rng() * (COLOURS.length - 1))) % COLOURS.length;
    lastColour = ci;
    const size = side === "h" ? range(rng, 320, 380) : range(rng, 380, 450);
    const jitter: Pt = side === "h" ? [range(rng, -30, 30), range(rng, -25, 25)] : [range(rng, -40, 40), range(rng, -30, 30)];
    const center: Pt = [p[0] + jitter[0], p[1] + jitter[1]];
    // Long shapes lie along their edge; a bit of tilt keeps it loose.
    const rot = (side === "v" ? Math.PI / 2 : 0) + range(rng, -0.3, 0.3);
    const shapeRng = mulberry32(Math.floor(rng() * 2 ** 31));
    const marks = SHAPES[shape](shapeRng);
    const strokes = marks.map((m) => {
      const ctrl = transformPts(m.ctrl, size, rot, center[0], center[1]);
      const pts = samplePath(m.straight ? polyPath(ctrl) : smoothPath(ctrl), SPACING);
      return { pts, size: strokeSize * range(rng, 0.9, 1.1), pressure: pressedEnds(pts.length, 0.5, 0.6, 0.05), thinning: 0.4 } as Stroke;
    });
    placed.push({
      strokes,
      colour: COLOURS[ci],
      center,
      size,
      phase: rng() * TAU,
      cycles: [1 + Math.floor(rng() * 3), 1 + Math.floor(rng() * 2)],
    });
  });
  return placed;
};

const frameDoodles = (id: string, ink: (layer: Layer, s: Stroke[], colour: string, off: Pt) => void, strokeSize: number, mono?: string): Doodle[] =>
  layout(strokeSize).map((d, i) => {
    const amp = d.size * 0.01;
    const bbox = bboxOf(
      d.strokes.flatMap((s) => s.pts),
      strokeSize + amp * 2 + 8,
    );
    return {
      bbox,
      center: d.center,
      driftPhase: d.phase,
      driftCycles: d.cycles,
      render: (layer, v) => ink(layer, variantsOf(id, i, v, d.strokes, amp), mono ?? d.colour, texOffset(id, i, v)),
    };
  });

export const doodleFrameCrayon = (id: string) => frameDoodles(id, crayonInk, 36);
export const doodleFrameChalk = (id: string) => frameDoodles(id, (l, s, c, o) => chalkInk(l, s, c, o), 38, CHALK);
