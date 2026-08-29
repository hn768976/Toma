// The single source of truth for the three versions.
//
// Everything that differs between the blue chemistry field, the green
// mathematics field and the amber physics field lives here: palette, notation
// set, motion mode and depth range. No colour and no piece of notation is
// written anywhere else in the project.
//
// ACCURACY: every equation below balances or is a standard published result,
// and every structure is drawn with real bond angles. The balances are noted
// against each chemical equation.

import type { Cmd, P } from "./diagram";
import { ring, ringBonds, withLabelSize } from "./diagram";
import type { Node } from "./ast";
import {
  big,
  binom,
  cases,
  fence,
  frac,
  mat,
  n,
  r,
  sc,
  sp,
  sqrt,
  sub,
  sup,
  under,
  v,
  vec,
  y,
} from "./ast";

export type VariantKey = "chem" | "math" | "physics";

export type Palette = {
  /** Frame background at the corners. */
  deep: string;
  /** Centre of the radial wash. */
  wash: string;
  /** Mid-distance glyph tone. */
  mid: string;
  /** Near glyph tone. */
  bright: string;
  /** Distant glyph tone. */
  dim: string;
  /** Brightest highlights: flares and glow cores. */
  white: string;
};

export type MotionMode = "approach" | "recede" | "lateral";

export type Motion = {
  mode: MotionMode;
  /** +1 travels toward the viewer, −1 away from it, 0 removes depth motion. */
  depthDir: 1 | -1 | 0;
  /** +1 drifts away from the focus, −1 draws in toward it, 0 holds station. */
  radialDir: 1 | -1 | 0;
  /** Vanishing point / expansion origin, as a fraction of the frame. */
  focus: [number, number];
  /** Exponent on the depth-to-radius mapping: how hard the field splays. */
  spreadPow: number;
  /** Whole traversals of the range per 600-frame loop, per glyph. */
  laps: number[];
  /** "lateral" only — fraction of glyphs drifting right to left. */
  leftwardShare?: number;
  /** "lateral" only — on-screen size multiplier range, since depth no longer scales. */
  sizeRange?: [number, number];
};

export type Notation =
  /** A formula line, laid out by the expression engine. */
  | { id: string; kind: "equation"; e: Node; size?: number }
  /** A drawn structure or diagram. */
  | { id: string; kind: "structure"; cmds: Cmd[] };

export type Variant = {
  key: VariantKey;
  palette: Palette;
  notation: Notation[];
  motion: Motion;
  /** Depth range. Above 1.0 a glyph exceeds the frame and crops. */
  depth: { min: number; max: number };
  /** Glyphs alive at any moment. */
  count: number;
  /** On-screen width a mid-depth glyph aims for, in 4K pixels. */
  targetWidth: number;
};

// ===========================================================================
// CHEMISTRY — structures
// ===========================================================================

/** Skeletal bond length. Every structure is built from it. */
const L = 92;
/** Hexagon apothem: the offset between two fused six-ring centres is 2×this. */
const AP = L * Math.cos(Math.PI / 6);

const hex = (c: P) => ring(c, L, 6, 0);

// Benzene: regular hexagon, 120° at every vertex, three alternating double
// bonds drawn to the inside of the ring.
const BENZENE_V = hex([0, 0]);
const benzene: Cmd[] = ringBonds(BENZENE_V, [0, 0], [0, 2, 4]);

// Phenol: benzene carrying a hydroxyl. The label sits on the vertex.
const phenol: Cmd[] = [
  ...benzene,
  { c: "bond", a: BENZENE_V[0], b: [0, -2 * L] },
  { c: "lbl", at: [0, -2 * L], e: n("OH") },
];

// Pyridine: the aza analogue of benzene, N at position 1.
const PYR_V = hex([0, 0]);
const pyridine: Cmd[] = [
  ...ringBonds(PYR_V, [0, 0], [0, 2, 4]),
  { c: "lbl", at: PYR_V[0], e: n("N") },
];

// Tryptamine: an indole ring system with a 3-ethylamine side chain.
// The five-ring is fused across the C3a–C7a bond of the benzo ring; the
// Kekulé structure puts double bonds at C4=C5, C6=C7, C3a=C7a and C2=C3.
const R5 = L / (2 * Math.sin(Math.PI / 5));
const PENT_C: P = [AP + R5 * Math.cos(Math.PI / 5), 0];
const IND_V = hex([0, 0]);
const C7a = IND_V[1];
const C3a = IND_V[2];
const N1: P = [PENT_C[0] + R5 * Math.cos((288 * Math.PI) / 180), R5 * Math.sin((288 * Math.PI) / 180)];
const C2: P = [PENT_C[0] + R5, 0];
const C3: P = [PENT_C[0] + R5 * Math.cos((72 * Math.PI) / 180), R5 * Math.sin((72 * Math.PI) / 180)];
const chainA: P = [C3[0] + L * Math.cos(Math.PI / 3), C3[1] + L * Math.sin(Math.PI / 3)];
const chainB: P = [chainA[0] - L * Math.cos(Math.PI / 3), chainA[1] + L * Math.sin(Math.PI / 3)];
const chainN: P = [chainB[0] + L * Math.cos(Math.PI / 3), chainB[1] + L * Math.sin(Math.PI / 3)];

const tryptamine: Cmd[] = [
  ...ringBonds(IND_V, [0, 0], [1, 3, 5]),
  { c: "bond", a: C7a, b: N1 },
  { c: "bond", a: N1, b: C2 },
  { c: "bond", a: C2, b: C3, order: 2, toward: PENT_C },
  { c: "bond", a: C3, b: C3a },
  { c: "bond", a: C3, b: chainA },
  { c: "bond", a: chainA, b: chainB },
  { c: "bond", a: chainB, b: chainN },
  { c: "lbl", at: N1, e: n("NH") },
  { c: "lbl", at: chainN, e: sub(n("NH"), n("2")) },
];

// Ethanesulfonic acid: two carbons to a sulfonic acid group.
const S0: P = [0, 0];
const S1: P = [L * Math.cos(Math.PI / 6), -L / 2];
const SS: P = [2 * L * Math.cos(Math.PI / 6), 0];
const sulfonic: Cmd[] = [
  { c: "bond", a: S0, b: S1 },
  { c: "bond", a: S1, b: SS },
  { c: "bond", a: SS, b: [SS[0], -L], order: 2 },
  { c: "bond", a: SS, b: [SS[0], L], order: 2 },
  { c: "bond", a: SS, b: [SS[0] + L, 0] },
  { c: "lbl", at: SS, e: n("S") },
  { c: "lbl", at: [SS[0], -L], e: n("O") },
  { c: "lbl", at: [SS[0], L], e: n("O") },
  { c: "lbl", at: [SS[0] + L, 0], e: n("OH") },
];

// Nitrate ion. Formal charges shown explicitly: N is +1, the two singly
// bonded oxygens are −1 each, and the bracket carries the ion's net −1.
const NO3_O1: P = [0, -L];
const NO3_O2: P = [-L * Math.cos(Math.PI / 6), L / 2];
const NO3_O3: P = [L * Math.cos(Math.PI / 6), L / 2];
const nitrate: Cmd[] = [
  { c: "bond", a: [0, 0], b: NO3_O1, order: 2 },
  { c: "bond", a: [0, 0], b: NO3_O2 },
  { c: "bond", a: [0, 0], b: NO3_O3 },
  { c: "lbl", at: [0, 0], e: sup(n("N"), y("plus")) },
  { c: "lbl", at: NO3_O1, e: n("O") },
  { c: "lbl", at: NO3_O2, e: sup(n("O"), y("minus")) },
  { c: "lbl", at: NO3_O3, e: sup(n("O"), y("minus")) },
  { c: "poly", p: [[-168, -168], [-198, -168], [-198, 168], [-168, 168]] },
  { c: "poly", p: [[168, -168], [198, -168], [198, 168], [168, 168]] },
  { c: "lbl", at: [222, -150], e: sc(0.7, y("minus")), knock: false },
];

// 3-methylbutanoic acid: a branched chain terminating in −COOH.
const A1: P = [0, 0];
const A2: P = [L * Math.cos(Math.PI / 6), -L / 2];
const A3: P = [2 * L * Math.cos(Math.PI / 6), 0];
const A4: P = [3 * L * Math.cos(Math.PI / 6), -L / 2];
const branchedAcid: Cmd[] = [
  { c: "bond", a: A1, b: [A1[0], -L], order: 2 },
  { c: "bond", a: A1, b: [-L * Math.cos(Math.PI / 6), L / 2] },
  { c: "bond", a: A1, b: A2 },
  { c: "bond", a: A2, b: A3 },
  { c: "bond", a: A3, b: A4 },
  { c: "bond", a: A3, b: [A3[0], L] },
  { c: "lbl", at: [A1[0], -L], e: n("O") },
  { c: "lbl", at: [-L * Math.cos(Math.PI / 6), L / 2], e: n("HO") },
];

// 2-aminoethanol: a hydroxyl and an amine on adjacent carbons.
const aminoAlcohol: Cmd[] = [
  { c: "bond", a: [0, 0], b: [L * Math.cos(Math.PI / 6), -L / 2] },
  { c: "bond", a: [L * Math.cos(Math.PI / 6), -L / 2], b: [2 * L * Math.cos(Math.PI / 6), 0] },
  { c: "bond", a: [2 * L * Math.cos(Math.PI / 6), 0], b: [3 * L * Math.cos(Math.PI / 6), -L / 2] },
  { c: "lbl", at: [0, 0], e: n("HO") },
  { c: "lbl", at: [3 * L * Math.cos(Math.PI / 6), -L / 2], e: sub(n("NH"), n("2")) },
];

// Decalin: two cyclohexanes fused across a shared bond.
const DEC_A = hex([0, 0]);
const DEC_B = hex([2 * AP, 0]);
const decalin: Cmd[] = [...ringBonds(DEC_A, [0, 0]), ...ringBonds(DEC_B, [2 * AP, 0])];

// ===========================================================================
// PHYSICS — diagrams
// ===========================================================================

const freeBody: Cmd[] = [
  { c: "rect", at: [0, 0], w: 190, h: 155 },
  { c: "arrow", a: [0, -78], b: [0, -235] },
  { c: "lbl", at: [26, -215], e: vec(v("N")), anchor: "l", knock: false },
  { c: "arrow", a: [0, 78], b: [0, 235] },
  { c: "lbl", at: [26, 215], e: vec(r(v("m"), v("g"))), anchor: "l", knock: false },
  { c: "arrow", a: [95, 0], b: [285, 0] },
  { c: "lbl", at: [295, -10], e: vec(v("F")), anchor: "l", knock: false },
  { c: "arrow", a: [-95, 0], b: [-250, 0] },
  { c: "lbl", at: [-260, -10], e: vec(v("f")), anchor: "r", knock: false },
];

const vectorSum: Cmd[] = [
  { c: "arrow", a: [-190, 90], b: [-10, -90] },
  { c: "lbl", at: [-135, -30], e: vec(v("a")), anchor: "r", knock: false },
  { c: "arrow", a: [-10, -90], b: [200, -20] },
  { c: "lbl", at: [100, -95], e: vec(v("b")), anchor: "b", knock: false },
  { c: "arrow", a: [-190, 90], b: [200, -20] },
  { c: "lbl", at: [10, 90], e: vec(v("R")), anchor: "t", knock: false },
];

const circuit: Cmd[] = [
  { c: "line", a: [-210, -135], b: [210, -135] },
  { c: "line", a: [-210, 135], b: [210, 135] },
  { c: "line", a: [-210, -135], b: [-210, -46] },
  { c: "line", a: [-210, 46], b: [-210, 135] },
  { c: "cell", at: [-210, 0], dir: "v", size: 40 },
  { c: "line", a: [210, -135], b: [210, -78] },
  { c: "line", a: [210, 78], b: [210, 135] },
  { c: "zig", a: [210, -78], b: [210, 78], teeth: 5, amp: 30 },
  { c: "lbl", at: [262, 0], e: v("R"), anchor: "l", knock: false },
  { c: "lbl", at: [-262, 0], e: v("V"), anchor: "r", knock: false },
  { c: "arrow", a: [-60, -180], b: [60, -180] },
  { c: "lbl", at: [0, -196], e: v("I"), anchor: "b", knock: false },
];

const PJ = (x: number) => -140 + 260 * (x / 300) ** 2;
const projectile: Cmd[] = [
  {
    c: "curve",
    p: [
      [-300, PJ(-300)],
      [-200, PJ(-200)],
      [-100, PJ(-100)],
      [0, PJ(0)],
      [100, PJ(100)],
      [200, PJ(200)],
      [300, PJ(300)],
    ],
  },
  { c: "line", a: [-370, 120], b: [370, 120] },
  { c: "arrow", a: [-300, 120], b: [-160, -40] },
  { c: "lbl", at: [-150, -56], e: sub(vec(v("v")), n("0")), anchor: "l", knock: false },
  { c: "arrow", a: [-300, 120], b: [-160, 120] },
  { c: "lbl", at: [-150, 140], e: sub(v("v"), v("x")), anchor: "l", knock: false },
  { c: "arrow", a: [-300, 120], b: [-300, -40] },
  { c: "lbl", at: [-316, -52], e: sub(v("v"), v("y")), anchor: "r", knock: false },
  { c: "line", a: [-160, 120], b: [-160, -40], dash: [10, 12] },
  { c: "line", a: [-300, -40], b: [-160, -40], dash: [10, 12] },
  { c: "arc", at: [-300, 120], r: 78, from: -0.851, to: 0 },
  { c: "lbl", at: [-206, 84], e: n("θ"), anchor: "l", knock: false },
];

const dipoleLine = (a: number, bulge: number): Cmd => {
  const rad = (a * Math.PI) / 180;
  const sx = -200 + 34 * Math.cos(rad);
  const sy = 34 * Math.sin(rad);
  return {
    c: "curve",
    p: [
      [sx, sy],
      [-110, bulge * 0.72],
      [0, bulge],
      [110, bulge * 0.72],
      [-sx, sy],
    ],
    arrow: true,
  };
};
const fieldLines: Cmd[] = [
  { c: "circle", at: [-200, 0], r: 34 },
  { c: "lbl", at: [-200, 0], e: sc(0.8, y("plus")), knock: false },
  { c: "circle", at: [200, 0], r: 34 },
  { c: "lbl", at: [200, 0], e: sc(0.8, y("minus")), knock: false },
  { c: "arrow", a: [-160, 0], b: [162, 0] },
  dipoleLine(-30, -92),
  dipoleLine(-62, -172),
  dipoleLine(30, 92),
  dipoleLine(62, 172),
];

const springMass: Cmd[] = [
  { c: "line", a: [-330, -130], b: [-330, 130] },
  ...[-110, -55, 0, 55, 110].map<Cmd>((yy) => ({
    c: "line",
    a: [-330, yy],
    b: [-368, yy + 34],
  })),
  { c: "coil", a: [-330, 0], b: [-110, 0], turns: 7, amp: 42 },
  { c: "rect", at: [-20, 0], w: 180, h: 150 },
  { c: "lbl", at: [-20, 0], e: v("m"), knock: false },
  { c: "line", a: [-120, -150], b: [-120, 158], dash: [10, 12] },
  { c: "arrow", a: [-120, 196], b: [-20, 196] },
  { c: "lbl", at: [-70, 214], e: v("x"), anchor: "t", knock: false },
];

const lens: Cmd[] = [
  { c: "line", a: [-400, 0], b: [400, 0] },
  { c: "ellipse", at: [0, 0], rx: 27, ry: 152 },
  { c: "arrow", a: [-340, 0], b: [-340, -120] },
  { c: "poly", p: [[-340, -120], [0, -120], [340, 120]] },
  { c: "line", a: [-340, -120], b: [340, 120] },
  { c: "arrow", a: [340, 0], b: [340, 120] },
  { c: "line", a: [-170, -14], b: [-170, 14] },
  { c: "line", a: [170, -14], b: [170, 14] },
  { c: "lbl", at: [-170, 24], e: v("F"), anchor: "t", knock: false },
  { c: "lbl", at: [170, 24], e: v("F"), anchor: "t", knock: false },
];

// ===========================================================================
// VARIANTS
// ===========================================================================

export const VARIANTS: Record<VariantKey, Variant> = {
  // -------------------------------------------------------------------------
  chem: {
    key: "chem",
    palette: {
      deep: "#010514",
      wash: "#0A1F4A",
      mid: "#2E7FE8",
      bright: "#7FB8FF",
      dim: "#143A6B",
      white: "#E8F2FF",
    },
    depth: { min: 0.15, max: 1.4 },
    count: 70,
    targetWidth: 760,
    motion: {
      mode: "approach",
      depthDir: 1,
      radialDir: 1,
      focus: [0.5, 0.5],
      spreadPow: 2,
      laps: [1, 1, 2, 2, 3],
    },
    // 9 structures : 6 equations — the 60/40 split the look depends on.
    notation: [
      { id: "benzene", kind: "structure", cmds: benzene },
      { id: "phenol", kind: "structure", cmds: phenol },
      { id: "pyridine", kind: "structure", cmds: pyridine },
      { id: "tryptamine", kind: "structure", cmds: tryptamine },
      { id: "sulfonic", kind: "structure", cmds: sulfonic },
      { id: "nitrate", kind: "structure", cmds: nitrate },
      { id: "branched-acid", kind: "structure", cmds: branchedAcid },
      { id: "amino-alcohol", kind: "structure", cmds: aminoAlcohol },
      { id: "decalin", kind: "structure", cmds: decalin },

      // C 6=6, H 12=12, O 18=18
      {
        id: "photosynthesis",
        kind: "equation",
        e: r(
          n("6"), sub(n("CO"), n("2")), y("plus"), n("6"), sub(n("H"), n("2")), n("O"),
          y("yields"),
          sub(n("C"), n("6")), sub(n("H"), n("12")), sub(n("O"), n("6")),
          y("plus"), n("6"), sub(n("O"), n("2")),
        ),
      },
      // K 2=2, N 2=2, O 9=9, H 2=2, C 1=1
      {
        id: "nitrate-carbonate",
        kind: "equation",
        e: r(
          n("2"), sub(n("KNO"), n("3")), y("plus"),
          sub(n("H"), n("2")), sub(n("CO"), n("3")),
          y("yields"),
          sub(n("K"), n("2")), sub(n("CO"), n("3")), y("plus"),
          n("2"), sub(n("HNO"), n("3")),
        ),
      },
      // Ba 3=3, N 2=2, H 12=12, O 6=6
      {
        id: "barium-nitride",
        kind: "equation",
        e: r(
          sub(n("Ba"), n("3")), sub(n("N"), n("2")), y("plus"),
          n("6"), sub(n("H"), n("2")), n("O"),
          y("yields"),
          n("3"), n("Ba"), sub(fence("(", ")", n("OH")), n("2")), y("plus"),
          n("2"), sub(n("NH"), n("3")),
        ),
      },
      // H 4=4, O 2=2
      {
        id: "water-synthesis",
        kind: "equation",
        e: r(
          n("2"), sub(n("H"), n("2")), y("plus"), sub(n("O"), n("2")),
          y("yields"),
          n("2"), sub(n("H"), n("2")), n("O"),
        ),
      },
      // Ca 1=1, C 1=1, O 3=3
      {
        id: "calcination",
        kind: "equation",
        e: r(
          sub(n("CaCO"), n("3")),
          y("yields"),
          n("CaO"), y("plus"), sub(n("CO"), n("2")),
        ),
      },
      // N 2=2, H 6=6 — an equilibrium, hence the double harpoon.
      {
        id: "haber",
        kind: "equation",
        e: r(
          sub(n("N"), n("2")), y("plus"), n("3"), sub(n("H"), n("2")),
          y("equil"),
          n("2"), sub(n("NH"), n("3")),
        ),
      },
    ],
  },

  // -------------------------------------------------------------------------
  math: {
    key: "math",
    palette: {
      deep: "#010F06",
      wash: "#063D1E",
      mid: "#2EC44F",
      bright: "#7FFFA0",
      dim: "#0F4A22",
      white: "#E8FFEE",
    },
    depth: { min: 0.08, max: 1.2 },
    // Convergence toward a vanishing point piles glyphs up at the far end, so
    // the population comes down from 70 or the centre becomes an unreadable mat.
    count: 55,
    targetWidth: 700,
    motion: {
      mode: "recede",
      depthDir: -1,
      radialDir: -1,
      focus: [0.5, 0.42],
      spreadPow: 1.7,
      laps: [1, 1, 2, 2, 3],
    },
    notation: [
      // ∫₀^π sin x dx = 2
      {
        id: "definite-integral",
        kind: "equation",
        e: r(
          big("int", n("0"), n("π"), true), n("sin"), sp(0.18), v("x"), sp(0.16),
          n("d"), v("x"), y("eq"), n("2"),
        ),
      },
      // Σ k² from 1 to n = n(n+1)(2n+1)/6
      {
        id: "sum-of-squares",
        kind: "equation",
        e: r(
          big("sum", r(v("k"), y("eq"), n("1")), v("n")), sup(v("k"), n("2")), y("eq"),
          frac(
            r(v("n"), fence("(", ")", r(v("n"), y("plus"), n("1"))),
              fence("(", ")", r(n("2"), v("n"), y("plus"), n("1")))),
            n("6"),
          ),
        ),
      },
      {
        id: "matrix-2x2",
        kind: "equation",
        e: r(v("A"), y("eq"), mat([[v("a"), v("b")], [v("c"), v("d")]])),
      },
      {
        id: "matrix-3x3",
        kind: "equation",
        e: r(
          sub(v("I"), n("3")), y("eq"),
          mat([
            [n("1"), n("0"), n("0")],
            [n("0"), n("1"), n("0")],
            [n("0"), n("0"), n("1")],
          ]),
        ),
      },
      // Leibniz notation for y = x³
      {
        id: "leibniz-derivative",
        kind: "equation",
        e: r(
          frac(r(n("d"), v("y")), r(n("d"), v("x"))), y("eq"), n("3"), sup(v("x"), n("2")),
        ),
      },
      // lim (x²−4)/(x−2) = 4 as x → 2
      {
        id: "limit",
        kind: "equation",
        e: r(
          under(n("lim"), r(v("x"), y("to"), n("2"))), sp(0.2),
          frac(r(sup(v("x"), n("2")), y("minus"), n("4")), r(v("x"), y("minus"), n("2"))),
          y("eq"), n("4"),
        ),
      },
      {
        id: "quadratic-formula",
        kind: "equation",
        e: r(
          v("x"), y("eq"),
          frac(
            r(y("minus"), v("b"), y("pm"),
              sqrt(r(sup(v("b"), n("2")), y("minus"), n("4"), v("a"), v("c")))),
            r(n("2"), v("a")),
          ),
        ),
      },
      {
        id: "euler-identity",
        kind: "equation",
        e: r(sup(v("e"), r(v("i"), n("π"))), y("plus"), n("1"), y("eq"), n("0")),
      },
      // f = x²y  ⇒  ∂f/∂x = 2xy
      {
        id: "partial-derivative",
        kind: "equation",
        e: r(
          frac(r(y("partial"), v("f")), r(y("partial"), v("x"))), y("eq"),
          n("2"), v("x"), v("y"),
        ),
      },
      {
        id: "compound-fraction",
        kind: "equation",
        e: frac(
          r(sup(v("x"), n("2")), y("plus"), n("2"), v("x"), y("plus"), n("1")),
          r(v("x"), y("plus"), n("1")),
        ),
      },
      {
        id: "root-of-binomial",
        kind: "equation",
        e: r(v("r"), y("eq"), sqrt(r(sup(v("x"), n("2")), y("plus"), sup(v("y"), n("2"))))),
      },
      // Σ xⁿ/n! from 0 to ∞ = eˣ
      {
        id: "exponential-series",
        kind: "equation",
        e: r(
          big("sum", r(v("n"), y("eq"), n("0")), y("infty")),
          frac(sup(v("x"), v("n")), r(v("n"), n("!"))),
          y("eq"), sup(v("e"), v("x")),
        ),
      },
      {
        id: "vector-triple",
        kind: "equation",
        e: r(
          vec(v("v")), y("eq"),
          fence("<", ">", r(n("3"), n(","), sp(0.24), y("minus"), n("4"), n(","), sp(0.24), n("5"))),
        ),
      },
      {
        id: "piecewise",
        kind: "equation",
        e: r(
          v("f"), fence("(", ")", v("x")), y("eq"),
          cases([
            [sup(v("x"), n("2")), r(v("x"), y("geq"), n("0"))],
            [r(y("minus"), sup(v("x"), n("2"))), r(v("x"), y("lt"), n("0"))],
          ]),
        ),
      },
      {
        id: "logarithm",
        kind: "equation",
        e: r(sub(n("log"), n("2")), sp(0.18), n("8"), y("eq"), n("3")),
      },
      {
        id: "binomial-coefficient",
        kind: "equation",
        e: r(
          binom(v("n"), v("k")), y("eq"),
          frac(
            r(v("n"), n("!")),
            r(v("k"), n("!"), sp(0.12), fence("(", ")", r(v("n"), y("minus"), v("k"))), n("!")),
          ),
        ),
      },
    ],
  },

  // -------------------------------------------------------------------------
  physics: {
    key: "physics",
    palette: {
      deep: "#140A01",
      wash: "#3D2408",
      mid: "#E8942E",
      bright: "#FFD48F",
      dim: "#6B4514",
      white: "#FFF4E0",
    },
    // Depth no longer scales anything — it drives blur, alpha and speed only.
    depth: { min: 0.2, max: 1.2 },
    count: 70,
    targetWidth: 720,
    motion: {
      mode: "lateral",
      depthDir: 0,
      radialDir: 0,
      focus: [0.5, 0.5],
      spreadPow: 1,
      laps: [1, 1, 2, 2, 3],
      leftwardShare: 0.72,
      sizeRange: [0.42, 1.5],
    },
    notation: [
      // Equations
      {
        id: "newton-second-law",
        kind: "equation",
        e: r(sc(0.68, big("sum")), sp(0.22), vec(v("F")), y("eq"), v("m"), sp(0.16), vec(v("a"))),
      },
      {
        id: "wave-equation",
        kind: "equation",
        e: r(
          frac(r(sup(y("partial"), n("2")), v("u")), r(y("partial"), sup(v("t"), n("2")))),
          y("eq"), sup(v("c"), n("2")), sp(0.14),
          frac(r(sup(y("partial"), n("2")), v("u")), r(y("partial"), sup(v("x"), n("2")))),
        ),
      },
      {
        id: "ohms-law",
        kind: "equation",
        e: r(v("V"), y("eq"), v("I"), v("R")),
      },
      {
        id: "ideal-gas-law",
        kind: "equation",
        e: r(v("P"), v("V"), y("eq"), v("n"), v("R"), v("T")),
      },
      {
        id: "coulombs-law",
        kind: "equation",
        e: r(
          v("F"), y("eq"), v("k"), sp(0.1),
          frac(r(sub(v("q"), n("1")), sub(v("q"), n("2"))), sup(v("r"), n("2"))),
        ),
      },
      // Time-independent Schrödinger equation in one dimension.
      {
        id: "schrodinger",
        kind: "equation",
        e: r(
          y("minus"),
          frac(sup(y("hbar"), n("2")), r(n("2"), v("m"))), sp(0.1),
          frac(r(sup(y("partial"), n("2")), n("ψ")), r(y("partial"), sup(v("x"), n("2")))),
          y("plus"), v("V"), n("ψ"), y("eq"), v("E"), n("ψ"),
        ),
      },
      {
        id: "mass-energy",
        kind: "equation",
        e: r(v("E"), y("eq"), v("m"), sup(v("c"), n("2"))),
      },
      {
        id: "angular-velocity",
        kind: "equation",
        e: r(
          n("ω"), y("eq"), frac(r(n("Δ"), n("θ")), r(n("Δ"), v("t"))), y("eq"),
          frac(v("v"), v("r")),
        ),
      },
      {
        id: "radioactive-decay",
        kind: "equation",
        e: r(
          v("N"), fence("(", ")", v("t")), y("eq"),
          sub(v("N"), n("0")), sup(v("e"), r(y("minus"), n("λ"), v("t"))),
          n(","), sp(0.5),
          sub(v("t"), sc(0.85, frac(n("1"), n("2")))), y("eq"),
          frac(r(n("ln"), sp(0.14), n("2")), n("λ")),
        ),
      },

      // Diagrams
      { id: "free-body", kind: "structure", cmds: withLabelSize(freeBody, 80) },
      { id: "vector-sum", kind: "structure", cmds: withLabelSize(vectorSum, 80) },
      { id: "circuit", kind: "structure", cmds: withLabelSize(circuit, 80) },
      { id: "projectile", kind: "structure", cmds: withLabelSize(projectile, 80) },
      { id: "field-lines", kind: "structure", cmds: withLabelSize(fieldLines, 80) },
      { id: "spring-mass", kind: "structure", cmds: withLabelSize(springMass, 80) },
      { id: "lens-rays", kind: "structure", cmds: withLabelSize(lens, 80) },
    ],
  },
};

export const VARIANT_KEYS: VariantKey[] = ["chem", "math", "physics"];

export type { Node, Cmd };
