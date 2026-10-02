import type { CalculateMetadataFunction } from "remotion";
import { FONT_A, FONT_B, fontsReady } from "./fonts";
import type { StyleName } from "../words";

// Size rules, as fractions of the frame.
export const STYLE_RULES: Record<
  StyleName,
  { font: string; capHeight: number; letterSpacingEm: number }
> = {
  AttackGlitch: { font: FONT_A, capHeight: 0.1, letterSpacingEm: 0.16 },
  DataRain: { font: FONT_B, capHeight: 0.09, letterSpacingEm: 0.02 },
};
export const MAX_WORD_WIDTH = 0.88;

// Compositions are defined at 4K. Every size is stored as a fraction of the
// frame, so --scale renders (1080p previews, 6000x3375 stills) match exactly.
export const COMP_WIDTH = 3840;
export const COMP_HEIGHT = 2160;

// Everything below is in units of frame HEIGHT, so it holds at any resolution.
export type WordLayout = {
  fontSize: number; // font-size / frame height
  capHeight: number; // measured cap height / frame height
  width: number; // total word width / frame height
  letters: { ch: string; x: number; w: number }[]; // x from word's left edge
  scaledDown: boolean; // true if the 88% rule shrank it
  scale: number; // 1 unless scaledDown
};

export type WordProps = {
  word: string;
  seed: number;
  layout: WordLayout | null;
};

const measure = (
  style: StyleName,
  word: string,
  width: number,
  height: number,
): WordLayout => {
  const rule = STYLE_RULES[style];
  const ctx = document.createElement("canvas").getContext("2d")!;
  const REF = 1000;
  ctx.font = `${REF}px "${rule.font}"`;
  if (!document.fonts.check(ctx.font)) {
    throw new Error(`Font ${rule.font} not loaded before measuring`);
  }
  const capRatio = ctx.measureText("H").actualBoundingBoxAscent / REF;
  let fontPx = (rule.capHeight * height) / capRatio;

  const layoutAt = (px: number) => {
    const k = px / REF;
    const ls = rule.letterSpacingEm * px;
    const chars = [...word];
    const letters = chars.map((ch, i) => {
      // Prefix widths keep the font's own kerning between letters.
      const x = ctx.measureText(chars.slice(0, i).join("")).width * k + i * ls;
      return { ch, x, w: ctx.measureText(ch).width * k };
    });
    const total = ctx.measureText(word).width * k + (chars.length - 1) * ls;
    return { letters, total };
  };

  let { letters, total } = layoutAt(fontPx);
  const maxW = MAX_WORD_WIDTH * width;
  let scale = 1;
  if (total > maxW) {
    scale = maxW / total;
    fontPx *= scale;
    ({ letters, total } = layoutAt(fontPx));
  }
  return {
    fontSize: fontPx / height,
    capHeight: (capRatio * fontPx) / height,
    width: total / height,
    letters: letters.map((l) => ({
      ch: l.ch,
      x: l.x / height,
      w: l.w / height,
    })),
    scaledDown: scale < 1,
    scale,
  };
};

export const calculateWordMetadata =
  (style: StyleName): CalculateMetadataFunction<WordProps> =>
  async ({ props }) => {
    await fontsReady;
    await document.fonts.ready;
    return {
      props: {
        ...props,
        layout: measure(style, props.word, COMP_WIDTH, COMP_HEIGHT),
      },
    };
  };
