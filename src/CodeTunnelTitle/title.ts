import {PALETTE} from './palette';

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
  red: HTMLCanvasElement;
  cyan: HTMLCanvasElement;
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
  capHeight: number,
  trackingEm: number
): TitleLayers => {
  const probeCanvas = document.createElement('canvas');
  const probe = probeCanvas.getContext('2d');
  if (!probe) {
    throw new Error('Could not acquire a 2D context to measure the title');
  }

  probe.font = `800 100px ${fontFamily}, sans-serif`;
  const capRatio = probe.measureText('H').actualBoundingBoxAscent / 100 || 0.72;
  const fontSize = capHeight / capRatio;
  const font = `800 ${fontSize}px ${fontFamily}, sans-serif`;

  probe.font = font;
  const tracking = fontSize * trackingEm;
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
    core: layer(PALETTE.titleWhite, 0),
    red: layer(PALETTE.fringeRed, 0),
    cyan: layer(PALETTE.fringeCyan, 0),
    glowNear: layer('#FFFFFF', 52),
    glowWide: layer('#BEDCFF', 118),
    bloom: layer('#FFFFFF', 32),
    width,
    height,
    capHeight,
    baseline,
    left,
    textWidth,
  };
};
