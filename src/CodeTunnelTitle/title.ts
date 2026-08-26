import {Theme} from './themes';

/**
 * The title is prerendered once into a handful of small layers -- core, the two
 * chromatic fringes, two glow passes and a bloom pass -- and then blitted with a
 * transform every frame.
 *
 * Doing it the obvious way (laying the type out and running `ctx.filter =
 * 'blur(...)'` on the 4K canvas four times per frame) makes Skia allocate a
 * full 3840x2160 layer for every filtered draw, which on its own costs more
 * than the entire rest of the frame.
 */

export type TitleLayers = {
  core: HTMLCanvasElement;
  fringeA: HTMLCanvasElement;
  fringeB: HTMLCanvasElement;
  glowNear: HTMLCanvasElement;
  glowWide: HTMLCanvasElement;
  bloom: HTMLCanvasElement;
  width: number;
  height: number;
  /** Cap height baked into the layers, in layer pixels. */
  capHeight: number;
  /** Baseline position inside the layer. */
  baseline: number;
  /** Left edge of the type inside the layer. */
  left: number;
  /** Advance width of the tracked type. */
  textWidth: number;
  fit: TitleFit;
};

export type TitleFit = {
  /** Cap height actually used, after any fit-to-width shrink. */
  capHeight: number;
  /** Letterspacing actually used, in em. */
  trackingEm: number;
  /** Whether the title had to be shrunk to stay inside its width budget. */
  fitted: boolean;
};

const PAD = 360;

const measureTracked = (
  ctx: CanvasRenderingContext2D,
  text: string,
  tracking: number
) => {
  let w = 0;
  for (const ch of text) {
    w += ctx.measureText(ch).width + tracking;
  }
  return w - tracking;
};

const drawTracked = (
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  tracking: number
) => {
  let cx = x;
  for (const ch of text) {
    ctx.fillText(ch, cx, y);
    cx += ctx.measureText(ch).width + tracking;
  }
};

export const prepareTitle = (
  title: string,
  fontFamily: string,
  theme: Theme,
  /** Cap height to aim for, in pixels, before any fit-to-width shrink. */
  capHeight: number,
  /** Hard ceiling on the rendered width, in pixels. */
  maxWidth: number
): TitleLayers => {
  const probeCanvas = document.createElement('canvas');
  const probe = probeCanvas.getContext('2d');
  if (!probe) {
    throw new Error('Could not acquire a 2D context to measure the title');
  }

  probe.font = `800 100px ${fontFamily}, sans-serif`;
  const capRatio = probe.measureText('H').actualBoundingBoxAscent / 100 || 0.72;

  // Width is linear in font size, so one measurement is enough to work out the
  // shrink a long title needs. Letterspacing scales with it, so the type keeps
  // its proportions instead of being squeezed.
  probe.font = `800 ${capHeight / capRatio}px ${fontFamily}, sans-serif`;
  const naturalWidth = measureTracked(
    probe,
    title,
    (capHeight / capRatio) * theme.titleTrackingEm
  );
  const shrink = naturalWidth > maxWidth ? maxWidth / naturalWidth : 1;

  const fontSize = (capHeight * shrink) / capRatio;
  const font = `800 ${fontSize}px ${fontFamily}, sans-serif`;

  probe.font = font;
  const tracking = fontSize * theme.titleTrackingEm;
  const textWidth = measureTracked(probe, title, tracking);
  const metrics = probe.measureText(title);
  const ascent = Math.ceil(metrics.actualBoundingBoxAscent || fontSize * 0.75);
  const descent = Math.ceil(metrics.actualBoundingBoxDescent || fontSize * 0.25);

  const width = Math.ceil(textWidth) + PAD * 2;
  const height = ascent + descent + PAD * 2;
  const baseline = PAD + ascent;
  const left = PAD;

  const layer = (
    fill: string,
    blur: number
  ): HTMLCanvasElement => {
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      throw new Error('Could not acquire a 2D context for a title layer');
    }
    ctx.font = font;
    ctx.textBaseline = 'alphabetic';
    ctx.textAlign = 'left';
    ctx.fillStyle = fill;
    if (blur > 0) {
      ctx.filter = `blur(${blur}px)`;
    }
    drawTracked(ctx, title, left, baseline, tracking);
    return canvas;
  };

  return {
    core: layer(theme.colors.title, 0),
    fringeA: layer(theme.colors.fringeA, 0),
    fringeB: layer(theme.colors.fringeB, 0),
    glowNear: layer(theme.colors.titleGlowNear, 52),
    glowWide: layer(theme.colors.titleGlowWide, 118),
    bloom: layer(theme.colors.titleBloom, 32),
    width,
    height,
    capHeight: capHeight * shrink,
    baseline,
    left,
    textWidth,
    fit: {capHeight: capHeight * shrink, trackingEm: theme.titleTrackingEm, fitted: shrink < 1},
  };
};
