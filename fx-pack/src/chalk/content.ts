/**
 * Chalk-maths content (edit here). Formulas use a small DSL:
 *   "text", { sup: ... }, { sub: ... }, { sqrt: ... }, { frac: [num, den] }
 * All formulas are mathematically correct; see README for the check list.
 */
import type { Tok } from "./strokes";
import type { DiagramName } from "./diagrams";

export type Formula = { id: string; tex: string; tokens: Tok[] };

export const FORMULAS: Formula[] = [
  { id: "pythagoras", tex: "a² + b² = c²", tokens: ["a", { sup: "2" }, " + b", { sup: "2" }, " = c", { sup: "2" }] },
  { id: "einstein", tex: "E = mc²", tokens: ["E = mc", { sup: "2" }] },
  { id: "pi", tex: "π = 3.1416", tokens: ["π = 3.1416"] },
  { id: "root1225", tex: "√1225 = 35", tokens: [{ sqrt: "1225" }, " = 35"] },
  {
    id: "quadratic",
    tex: "x = (−b ± √(b² − 4ac)) / 2a",
    tokens: ["x = ", { frac: [["−b ± ", { sqrt: ["b", { sup: "2" }, " − 4ac"] }], "2a"] }],
  },
  { id: "factor", tex: "6x² − 15xy = 3x(2x − 5y)", tokens: ["6x", { sup: "2" }, " − 15xy = 3x(2x − 5y)"] },
  { id: "logistic", tex: "dN/dt = rN(K − N)/K", tokens: [{ frac: ["dN", "dt"] }, " = ", { frac: ["rN(K − N)", "K"] }] },
  { id: "potential", tex: "Eₚ = mgh", tokens: ["E", { sub: "p" }, " = mgh"] },
  {
    id: "distance",
    tex: "d = √((x₂ − x₁)² + (y₂ − y₁)²)",
    tokens: [
      "d = ",
      { sqrt: ["(x", { sub: "2" }, " − x", { sub: "1" }, ")", { sup: "2" }, " + (y", { sub: "2" }, " − y", { sub: "1" }, ")", { sup: "2" }] },
    ],
  },
  { id: "sqrtA", tex: "x = √a", tokens: ["x = ", { sqrt: "a" }] },
  { id: "cube", tex: "y = x³", tokens: ["y = x", { sup: "3" }] },
  {
    id: "expSeries",
    tex: "eˣ = 1 + x + x²/2! + x³/3! + …",
    tokens: ["e", { sup: "x" }, " = 1 + x + ", { frac: [["x", { sup: "2" }], "2!"] }, " + ", { frac: [["x", { sup: "3" }], "3!"] }, " + …"],
  },
  // extras for variety in the flythrough
  { id: "circleArea", tex: "A = πr²", tokens: ["A = πr", { sup: "2" }] },
  { id: "sphereVolume", tex: "V = 4/3 πr³", tokens: ["V = ", { frac: ["4", "3"] }, "πr", { sup: "3" }] },
  { id: "binomial", tex: "(a + b)² = a² + 2ab + b²", tokens: ["(a + b)", { sup: "2" }, " = a", { sup: "2" }, " + 2ab + b", { sup: "2" }] },
  { id: "newton", tex: "F = ma", tokens: ["F = ma"] },
];

export const DIAGRAM_NAMES: DiagramName[] = ["cone", "sphere", "triangle", "goldenSpiral", "sineGraph", "venn"];
