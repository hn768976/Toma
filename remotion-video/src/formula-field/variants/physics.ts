// Version 3 — "physics": amber, lateral drift, flat depth.
//
// Everything that makes this version what it is: palette, notation set,
// motion mode and depth range. No colour and no piece of notation is written
// anywhere else in the project.
//
// ACCURACY: every equation below is a standard law in its usual form, and the
// diagrams are drawn to scale — the lens ray diagram really does put an object
// at 2f and its image, inverted and the same size, at 2f on the far side.

import type { Cmd } from "../diagram";
import { withLabelSize } from "../diagram";
import type { Variant } from "../variant-types";
import {
  big,
  fence,
  frac,
  n,
  r,
  sc,
  sp,
  sub,
  sup,
  v,
  vec,
  y,
} from "../ast";

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

export type VariantKey = "physics";

export const VARIANT: Variant = {
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
};
