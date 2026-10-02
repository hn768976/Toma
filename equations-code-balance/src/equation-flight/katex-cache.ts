import katex from "katex";
import { FORMULAS } from "./formulas";

/**
 * Every formula is turned into KaTeX HTML exactly once, when this module is
 * first imported. Frames only reuse these strings.
 */
export const FORMULA_HTML: string[] = FORMULAS.map((f) =>
  katex.renderToString(f.tex, {
    throwOnError: true,
    displayMode: false,
    output: "html",
  }),
);
