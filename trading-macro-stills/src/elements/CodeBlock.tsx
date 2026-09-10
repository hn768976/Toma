import { rgba, shade } from "../lib/color";
import type { Rng } from "../lib/rng";
import type { ColorKey } from "../palettes";
import type { CodeSpec } from "../types";
import { MONO, asElement, type ElementProps } from "./common";

type Token = { text: string; role: ColorKey };

const KEYWORD = "curveSecondary";
const NAME = "textBright";
const VALUE = "curvePrimary";
const PUNCT = "textDim";

const HEADS = ["mark", "blend", "drift", "seek", "clamp", "fold", "warp", "sift", "tally", "prime"];
const TAILS = ["Spread", "Band", "Ledger", "Window", "Cursor", "Bucket", "Slice", "Frame", "Ratio", "Depth"];
const FIELDS = ["bid", "ask", "span", "tick", "lot", "edge", "carry", "skew", "pace", "book"];

/**
 * Every line here is invented. Nothing in this block reproduces real library
 * source, a licence header, or any third-party code — it exists only to give
 * the layer the shape and colour of code seen out of focus.
 */
const fnName = (rng: Rng) => rng.pick(HEADS) + rng.pick(TAILS);
const varName = (rng: Rng) => rng.pick(HEADS) + rng.pick(TAILS).toLowerCase();
const num = (rng: Rng) =>
  rng.chance(0.4) ? rng.range(0, 1).toFixed(4) : String(rng.int(2, 512));

const makeLines = (rng: Rng, count: number): Token[][] => {
  const lines: Token[][] = [];
  let indent = 0;
  const open: string[] = [];

  const push = (tokens: Token[]) => {
    lines.push([{ text: "  ".repeat(indent), role: PUNCT }, ...tokens]);
  };

  while (lines.length < count) {
    const roll = rng.next();
    if (open.length > 0 && (roll > 0.78 || indent > 3)) {
      indent = Math.max(0, indent - 1);
      open.pop();
      push([{ text: "}", role: PUNCT }]);
      continue;
    }
    if (roll < 0.16) {
      push([
        { text: "export ", role: KEYWORD },
        { text: "function ", role: KEYWORD },
        { text: fnName(rng), role: NAME },
        { text: `(${rng.pick(FIELDS)}, ${rng.pick(FIELDS)}) {`, role: PUNCT },
      ]);
      indent++;
      open.push("fn");
    } else if (roll < 0.32) {
      push([
        { text: "for ", role: KEYWORD },
        { text: `(let i = 0; i < ${rng.pick(FIELDS)}.length; i++) {`, role: PUNCT },
      ]);
      indent++;
      open.push("for");
    } else if (roll < 0.46) {
      push([
        { text: "if ", role: KEYWORD },
        { text: `(${rng.pick(FIELDS)}[i] > `, role: PUNCT },
        { text: num(rng), role: VALUE },
        { text: ") {", role: PUNCT },
      ]);
      indent++;
      open.push("if");
    } else if (roll < 0.62) {
      push([
        { text: "const ", role: KEYWORD },
        { text: varName(rng), role: NAME },
        { text: " = ", role: PUNCT },
        { text: num(rng), role: VALUE },
        { text: ";", role: PUNCT },
      ]);
    } else if (roll < 0.74) {
      push([
        { text: "return ", role: KEYWORD },
        { text: fnName(rng), role: NAME },
        { text: `(${rng.pick(FIELDS)}, `, role: PUNCT },
        { text: num(rng), role: VALUE },
        { text: ");", role: PUNCT },
      ]);
    } else {
      push([
        { text: `${rng.pick(FIELDS)}.`, role: PUNCT },
        { text: fnName(rng), role: NAME },
        { text: `("${rng.pick(HEADS)}", `, role: VALUE },
        { text: num(rng), role: VALUE },
        { text: ");", role: PUNCT },
      ]);
    }
  }
  return lines;
};

const draw = ({
  ctx,
  width,
  height,
  palette,
  rng,
  spec,
}: ElementProps<CodeSpec>): void => {
  ctx.font = `${spec.fontSize}px ${MONO}`;
  ctx.textBaseline = "top";
  const rows = Math.ceil(height / spec.lineHeight) + 1;
  const lines = makeLines(rng, rows);

  ctx.globalAlpha = spec.gain;
  for (let r = 0; r < rows; r++) {
    let x = 0;
    const y = r * spec.lineHeight;
    for (const token of lines[r]) {
      ctx.fillStyle =
        token.role === PUNCT
          ? shade(palette, PUNCT, 1.4, 0.95)
          : rgba(palette, token.role, token.role === NAME ? 0.95 : 0.9);
      ctx.fillText(token.text, x, y);
      x += ctx.measureText(token.text).width;
      if (x > width * 1.4) break;
    }
  }
  ctx.globalAlpha = 1;
};

export const CodeBlock = asElement<CodeSpec>("CodeBlock", draw);
