// Vendored from @studio/remotion-lib (src/ArticleCard.ts). Do not edit here —
// edit the library and re-run `node scripts/sync-lib.mjs`.
/**
 * <ArticleCard> — a fragment of a generic article page, painted once to its
 * own offscreen canvas.
 *
 * Anatomy, top to bottom: a top rule or coloured band, site chrome (a square
 * placeholder mark and a generic wordmark, or a breadcrumb), a section label,
 * the headline, a byline and date, a body block, and optionally a grey
 * rectangle standing in for an image. Which of those appear, at what size and
 * in what typeface, varies card to card so a run of them never reads as one
 * template.
 *
 * The card carries no editorial content of its own: headlines, wordmarks,
 * section labels, bylines and dates are all supplied by the caller, and the
 * body copy is illegible generated filler. Callers are responsible for using
 * invented copy — this component is not a way to reproduce a real page.
 *
 * The card is built ONCE and returned as bitmap layers. Laying headlines and
 * body copy out per frame at 4K does not render in any usable time; the
 * keyword focus blur is baked in here too, so the per-frame cost is a blit.
 *
 * Returns two layers so the keyword can be treated separately downstream —
 * feed them straight to `composeMotionBlurred` as a LayeredSprite.
 */
import type { Ctx } from "./canvas2d";
import { clamp, context2d, makeCanvas, setBlur, setLetterSpacing } from "./canvas2d";
import { chance, pick, randInt, randRange, weighted } from "./seeded-random";
import { paperSurface } from "./paper-surface";
import { BodyBlock } from "./BodyBlock";
import { SiteChrome, type ChromeStyle } from "./SiteChrome";
import { KeywordHighlight, measureKeywordRun, type KeywordRunPlan } from "./KeywordHighlight";

/** Every colour the card paints with. Names describe roles, not hues. */
export interface ArticleCardPalette {
  /** The page surface most cards use. */
  surface: string;
  /** An alternate surface tone, used by a minority of cards. */
  surfaceAlt: string;
  /** Only consulted when `texturedSurface` is set: the mottling tone. */
  surfaceShade: string;
  /** Headline and keyword. */
  inkStrong: string;
  /** Chrome, section label, byline. */
  inkMid: string;
  /** Body filler. */
  inkSoft: string;
  /** Dark top rules and bands. */
  ruleDark: string;
  /** Accent top rules and bands. */
  ruleAccent: string;
  /** Image placeholder blocks. */
  imagePlaceholder: string;
}

export interface ArticleCardSpec {
  seed: string;
  headline: string;
  keyword: string;
  palette: ArticleCardPalette;
  fonts: { serif: string; sans: string; ui: string };
  /** Card width in device pixels. */
  width: number;
  /** Target card height; body line count is chosen to land near it. */
  targetHeight: number;
  headlineSize: number;
  headroom: number;
  serifBias: number;
  serifLabels: boolean;
  focusBlurMax: number;
  /** Distance at which peak blur is reached, as a fraction of the measure. */
  focusFalloff: number;
  /** Paint the surface with soft tonal mottling rather than a flat fill. */
  texturedSurface: boolean;
  /** Colour of the section label. */
  sectionColor: string;
  wordmarks: readonly string[];
  sections: readonly string[];
  bylines: readonly string[];
  dates: readonly string[];
  breadcrumbs: readonly string[][];
}

export interface ArticleCardLayers {
  /** Opaque card, everything except the keyword glyphs. */
  base: HTMLCanvasElement;
  /** The keyword glyphs alone, on transparent, so they can be blurred less. */
  overlay: HTMLCanvasElement;
  /** Where the overlay sits within the card. */
  overlayOffset: { x: number; y: number };
  /** Centre of the keyword in card coordinates — the card's anchor point. */
  anchor: { x: number; y: number };
  width: number;
  height: number;
}

type ImagePlacement = "none" | "above" | "beside" | "below";

const measuringCtx = (): Ctx => context2d(makeCanvas(8, 8));

interface CardPlan {
  width: number;
  height: number;
  pad: number;
  scale: number;
  tone: string;
  rule: { height: number; color: string; isBand: boolean };
  chrome: ChromeStyle | "none";
  wordmark: string;
  trail: string[];
  section: string | null;
  headline: KeywordRunPlan;
  headlineSize: number;
  headlineTop: number;
  byline: string;
  date: string;
  bodyTop: number;
  bodyLines: number;
  bodyParagraphs: number;
  bodyWidth: number;
  bodyFontSize: number;
  bodyLineHeight: number;
  image: { placement: ImagePlacement; x: number; y: number; w: number; h: number } | null;
  labelSize: number;
  chromeTop: number;
  sectionTop: number;
  bylineTop: number;
  softBlur: number;
}

/**
 * Decides every card-level variation and measures the resulting layout, so
 * the exact canvas height is known before a pixel is drawn.
 */
const planCard = (spec: ArticleCardSpec): CardPlan => {
  const ctx = measuringCtx();
  const { seed, palette, fonts } = spec;
  const W = spec.width;
  const scale = W / 2400;
  const pad = W * 0.053;

  const tone = chance(`${seed}-tone`, 0.3) ? palette.surfaceAlt : palette.surface;

  const isBand = chance(`${seed}-band`, 0.34);
  const ruleAccent = chance(`${seed}-accent`, 0.42);
  const rule = {
    isBand,
    height: isBand ? randRange(`${seed}-bandh`, 46, 78) * scale : randRange(`${seed}-ruleh`, 8, 22) * scale,
    color: ruleAccent ? palette.ruleAccent : palette.ruleDark,
  };

  const chrome = weighted<ChromeStyle | "none">(`${seed}-chrome`, [
    ["mark", 5],
    ["breadcrumb", 3],
    ["none", 2],
  ]);
  const wordmark = pick(`${seed}-wm`, spec.wordmarks);
  const trail = pick(`${seed}-bc`, spec.breadcrumbs).slice();
  const section = chance(`${seed}-sec`, 0.72) ? pick(`${seed}-secname`, spec.sections) : null;

  const labelSize = 33 * scale;
  const bodyFontSize = 28 * scale;
  const bodyLineHeight = 47 * scale;
  const softBlur = 2.0 * scale;

  // Headline: typeface alternates, and the size varies by up to ~40% between
  // the smallest and largest card.
  const useSerif = chance(`${seed}-serif`, spec.serifBias);
  // A card can be wider than the frame; text measure is capped independently
  // of card width so the columns stay the width a page would actually set.
  const headlineWidth = Math.min((W - pad * 2) * randRange(`${seed}-hw`, 0.86, 1.0), 3050);
  const faceWeight = useSerif ? 700 : 800;
  const faceFamily = useSerif ? fonts.serif : fonts.sans;
  const lineRatio = useSerif ? 1.13 : 1.08;
  let headlineSize = spec.headlineSize * randRange(`${seed}-hsize`, 0.8, 1.19);

  const imagePlacement = weighted<ImagePlacement>(`${seed}-img`, [
    ["none", 4],
    ["above", 2],
    ["beside", 3],
    ["below", 2],
  ]);

  // Walk the layout downwards, accumulating heights.
  const headroom = spec.headroom;
  let y = rule.height;
  y += pad * (rule.isBand ? 0.8 : 1.0) * headroom;

  const chromeTop = y;
  if (chrome !== "none") {
    y += (chrome === "mark" ? 33 * 1.55 : 33 * 1.35) * scale;
    y += pad * 0.52 * headroom;
  }

  const sectionTop = y;
  if (section) y += labelSize * 1.62 * headroom;

  const imageAboveHeight = randRange(`${seed}-imgh`, 250, 430) * scale;
  let image: CardPlan["image"] = null;
  if (imagePlacement === "above") {
    image = { placement: "above", x: pad, y, w: W - pad * 2, h: imageAboveHeight };
    y += imageAboveHeight + pad * 0.62;
  }

  const headlineTop = y;
  const runAt = (size: number) =>
    measureKeywordRun(ctx, {
      text: spec.headline,
      keyword: spec.keyword,
      x: pad,
      y: y + size * 0.8,
      maxWidth: headlineWidth,
      font: `${faceWeight} ${size}px ${faceFamily}`,
      fontSize: size,
      lineHeight: size * lineRatio,
      minBlur: size * 0.028,
      maxBlur: size * spec.focusBlurMax,
      falloff: headlineWidth * spec.focusFalloff,
      nearAlpha: 0.88,
      farAlpha: 0.58,
    });

  // Headlines run to one or two lines. A long one is stepped down until it
  // fits rather than being allowed to sprawl.
  let headline = runAt(headlineSize);
  for (let guard = 0; headline.lineCount > 2 && guard < 8; guard += 1) {
    headlineSize *= 0.93;
    headline = runAt(headlineSize);
  }
  y += headline.height + pad * 0.46;

  const bylineTop = y;
  y += labelSize * 1.62 + pad * 0.3;

  const bodyWidth = Math.min(
    imagePlacement === "beside"
      ? (W - pad * 2) * randRange(`${seed}-bw`, 0.5, 0.62)
      : (W - pad * 2) * randRange(`${seed}-bw`, 0.72, 1.0),
    2250,
  );

  const bodyTop = y;
  const bodyParagraphs = randInt(`${seed}-paras`, 1, 2);
  const bottomPad = pad * 0.95;
  const fixedHeight = y + bottomPad + (bodyParagraphs - 1) * bodyLineHeight * 0.55;
  const bodyLines = clamp(
    Math.round((spec.targetHeight - fixedHeight) / bodyLineHeight),
    3,
    12,
  );
  y += bodyLines * bodyLineHeight + (bodyParagraphs - 1) * bodyLineHeight * 0.55;

  if (imagePlacement === "beside") {
    const iw = W - pad * 2 - bodyWidth - pad * 0.6;
    image = {
      placement: "beside",
      x: pad + bodyWidth + pad * 0.6,
      y: bodyTop,
      w: iw,
      h: Math.min(iw * 0.72, bodyLines * bodyLineHeight),
    };
  } else if (imagePlacement === "below") {
    const ih = randRange(`${seed}-imgh2`, 200, 330) * scale;
    image = { placement: "below", x: pad, y: y + pad * 0.4, w: W - pad * 2, h: ih };
    y += ih + pad * 0.4;
  }

  y += bottomPad;

  return {
    width: W,
    height: Math.round(y),
    pad,
    scale,
    tone,
    rule,
    chrome,
    wordmark,
    trail,
    section,
    headline,
    headlineSize,
    headlineTop,
    byline: pick(`${seed}-by`, spec.bylines),
    date: pick(`${seed}-date`, spec.dates),
    bodyTop,
    bodyLines,
    bodyParagraphs,
    bodyWidth,
    bodyFontSize,
    bodyLineHeight,
    image,
    labelSize,
    chromeTop,
    sectionTop,
    bylineTop,
    softBlur,
  };
};

export const ArticleCard = (spec: ArticleCardSpec): ArticleCardLayers => {
  const plan = planCard(spec);
  const { palette, fonts, seed } = spec;
  const { width: W, height: H, pad, scale } = plan;

  const base = makeCanvas(W, H);
  const ctx = context2d(base);

  if (spec.texturedSurface) {
    // The surface is painted mottled rather than flat-filled.
    paperSurface(ctx, `${seed}-surface`, W, H, plan.tone, palette.surfaceShade, 0.04);
  } else {
    ctx.fillStyle = plan.tone;
    ctx.fillRect(0, 0, W, H);
  }

  // Top rule or coloured band.
  ctx.fillStyle = plan.rule.color;
  ctx.fillRect(0, 0, W, plan.rule.height);

  // Site chrome.
  if (plan.chrome !== "none") {
    SiteChrome(ctx, {
      style: plan.chrome,
      x: pad,
      y: plan.chromeTop,
      size: 33 * scale,
      wordmark: plan.wordmark,
      trail: plan.trail,
      font: `600 ${33 * scale}px ${fonts.ui}`,
      markColor: plan.rule.color,
      textColor: palette.inkMid,
      blur: plan.softBlur,
      alpha: 0.9,
    });
  }

  // Section label, in small caps.
  if (plan.section) {
    ctx.save();
    setBlur(ctx, plan.softBlur);
    ctx.textBaseline = "alphabetic";
    ctx.fillStyle = spec.sectionColor;
    ctx.font = spec.serifLabels
      ? `600 ${plan.labelSize}px ${fonts.serif}`
      : `700 ${plan.labelSize * 0.94}px ${fonts.ui}`;
    setLetterSpacing(ctx, plan.labelSize * 0.19);
    ctx.fillText(plan.section.toUpperCase(), pad, plan.sectionTop + plan.labelSize);
    setLetterSpacing(ctx, 0);
    ctx.restore();
  }

  // Image placeholder.
  if (plan.image) {
    ctx.save();
    setBlur(ctx, plan.softBlur * 1.4);
    ctx.fillStyle = palette.imagePlaceholder;
    ctx.fillRect(plan.image.x, plan.image.y, plan.image.w, plan.image.h);
    ctx.restore();
  }

  // The headline, minus the keyword — de-emphasised and graded into blur.
  KeywordHighlight(ctx, plan.headline, "rest", {
    keyword: palette.inkStrong,
    rest: palette.inkMid,
  });

  // Byline and date.
  ctx.save();
  setBlur(ctx, plan.softBlur * 1.15);
  ctx.textBaseline = "alphabetic";
  ctx.font = `500 ${plan.labelSize * 0.95}px ${fonts.ui}`;
  ctx.fillStyle = palette.inkMid;
  ctx.globalAlpha = 0.85;
  const bylineBaseline = plan.bylineTop + plan.labelSize;
  ctx.fillText(plan.byline, pad, bylineBaseline);
  const bylineWidth = ctx.measureText(plan.byline).width;
  ctx.globalAlpha = 0.6;
  ctx.fillStyle = palette.inkSoft;
  ctx.fillText(`  ·  ${plan.date}`, pad + bylineWidth, bylineBaseline);
  ctx.restore();

  // Body filler.
  BodyBlock(ctx, {
    x: pad,
    y: plan.bodyTop + plan.bodyFontSize,
    width: plan.bodyWidth,
    lineCount: plan.bodyLines,
    paragraphs: plan.bodyParagraphs,
    fontSize: plan.bodyFontSize,
    lineHeight: plan.bodyLineHeight,
    font: `400 ${plan.bodyFontSize}px ${fonts.ui}`,
    color: palette.inkSoft,
    alpha: 0.95,
    blur: plan.softBlur * 1.5,
    seed: `${seed}-body`,
  });

  // The keyword goes on its own layer, at full contrast and full sharpness.
  const box = plan.headline.keyword;
  if (!box) throw new Error(`Headline is missing the keyword "${spec.keyword}"`);
  const margin = plan.headlineSize * 0.55;
  const kw = makeCanvas(box.width + margin * 2, box.height + margin * 2);
  const kctx = context2d(kw);
  kctx.translate(-(box.x - margin), -(box.y - margin));
  KeywordHighlight(kctx, plan.headline, "keyword", {
    keyword: palette.inkStrong,
    rest: palette.inkMid,
  });

  return {
    base,
    overlay: kw,
    overlayOffset: { x: box.x - margin, y: box.y - margin },
    anchor: { x: box.cx, y: box.cy },
    width: W,
    height: H,
  };
};
