// Version 2 — "math": green, mathematics, receding.
//
// Everything that makes this version what it is: palette, notation set,
// motion mode and depth range. No colour and no piece of notation is written
// anywhere else in the project.
//
// ACCURACY: every expression below is a standard, correct result — the sums, the
// limit, the series and the closed forms are all as a specialist would write them.

import type { Variant } from "../variant-types";
import {
  big,
  binom,
  cases,
  fence,
  frac,
  mat,
  n,
  r,
  sp,
  sqrt,
  sub,
  sup,
  under,
  v,
  vec,
  y,
} from "../ast";

export type VariantKey = "math";

export const VARIANT: Variant = {
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
    spreadPow: 1.9,
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
};
