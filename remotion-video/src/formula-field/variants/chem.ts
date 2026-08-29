// Version 1 — "chem": blue, chemistry, approaching.
//
// Everything that makes this version what it is: palette, notation set,
// motion mode and depth range. No colour and no piece of notation is written
// anywhere else in the project.
//
// ACCURACY: every equation below balances (the balance is noted against each one) and
// every structure is drawn with real bond angles and formal charges.

import type { Cmd, P } from "../diagram";
import { ring, ringBonds } from "../diagram";
import type { Variant } from "../variant-types";
import {
  fence,
  n,
  r,
  sc,
  sub,
  sup,
  y,
} from "../ast";

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

export type VariantKey = "chem";

export const VARIANT: Variant = {
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
};
