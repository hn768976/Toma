import { useLayoutEffect } from "react";
import { blurPadding, blurRgbInPlace } from "../blur";
import { FALLOFFS, type BlobConfig } from "../compositions";
import { paletteColour, type ResolvedPalette } from "../palettes";
import { STAGE_ORDER, usePipeline, type FieldState } from "../pipeline";

/** Blur radii are authored at 3840 wide and scale with the frame. */
const REFERENCE_WIDTH = 3840;

/**
 * The blobs are composited in an 8-bit canvas, where 'lighter' clamps every
 * channel at 255. Left alone, a few overlapping blobs pin a channel across a
 * wide area and the result is a flat plateau with a hard contour — which is
 * exactly what makes a blob read as a disc rather than as light. Drawing at
 * half strength and scaling back up in float doubles the headroom before
 * anything clamps; the precision this costs is recovered by the blur, which
 * averages each output pixel over tens of thousands of samples.
 */
const DRAW_HEADROOM = 0.5;

/** Channel value above which the highlight rolls off instead of clipping. */
const HIGHLIGHT_KNEE = 198;
const CEILING = 255;

/**
 * A soft knee in place of a hard clamp. Bright cores still approach white,
 * but they approach it asymptotically, so there is no flat region and no
 * contour where the clamp would have started.
 */
const softKnee = (v: number): number => {
  if (v <= HIGHLIGHT_KNEE) return v;
  const range = CEILING - HIGHLIGHT_KNEE;
  return HIGHLIGHT_KNEE + range * (1 - Math.exp(-(v - HIGHLIGHT_KNEE) / range));
};

const makeCanvas = (width: number, height: number): HTMLCanvasElement => {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  return canvas;
};

/**
 * One blob: a radial gradient from its colour at the centre to fully
 * transparent at its radius, drawn inside a rotate + scale transform so an
 * elongated blob stretches along its own axis. The gradient's stop positions
 * come from the named falloff, and that variation is what stops the blob
 * reading as a disc — a plain linear ramp is a spotlight, a plateau that holds
 * and then drops is light.
 */
const drawBlob = (
  ctx: CanvasRenderingContext2D,
  blob: BlobConfig,
  palette: ResolvedPalette,
  width: number,
  height: number,
  pad: number,
): void => {
  const { r: red, g: green, b: blue } = paletteColour(palette, blob.colour);
  const radius = blob.r * width;

  ctx.save();
  ctx.translate(pad + blob.x * width, pad + blob.y * height);
  if (blob.rotate) ctx.rotate((blob.rotate * Math.PI) / 180);
  ctx.scale(blob.scaleX ?? 1, blob.scaleY ?? 1);

  const gradient = ctx.createRadialGradient(0, 0, 0, 0, 0, radius);
  for (const [offset, alpha] of FALLOFFS[blob.falloff]) {
    const a = alpha * blob.opacity * DRAW_HEADROOM;
    gradient.addColorStop(offset, `rgba(${red}, ${green}, ${blue}, ${a})`);
  }

  ctx.fillStyle = gradient;
  // The transform is already applied, so this rect is in blob-local space and
  // exactly circumscribes the gradient.
  ctx.fillRect(-radius, -radius, radius * 2, radius * 2);
  ctx.restore();
};

/**
 * Draws the composition's blobs additively and blurs the result heavily at
 * full resolution.
 *
 * Three details carry this stage:
 *  - 'lighter' compositing means overlapping blobs ADD, so a cyan blob over a
 *    magenta one produces the blue band between them for free instead of
 *    hiding it. That additive mixing is where the intermediate hues come from.
 *  - the blobs are drawn on a canvas padded by twice the blur sigma, because
 *    the blur would otherwise pull the transparent surround into the frame
 *    edges and eat the compositions that fill the frame.
 *  - the blur runs on the float buffer, never through `ctx.filter`. See
 *    ../blur.ts for why that distinction decides whether the field bands.
 */
export const renderColourField = (state: FieldState): void => {
  const { width, height, rgb, composition, palette } = state;

  const sigma = (composition.blur * width) / REFERENCE_WIDTH;
  const pad = blurPadding(sigma);
  const paddedWidth = width + pad * 2;
  const paddedHeight = height + pad * 2;

  const layer = makeCanvas(paddedWidth, paddedHeight);
  const ctx = layer.getContext("2d", { willReadFrequently: true });
  if (!ctx) throw new Error("2D canvas context unavailable");

  ctx.globalCompositeOperation = "lighter";
  for (const blob of composition.blobs) {
    drawBlob(ctx, blob, palette, width, height, pad);
  }

  const data = ctx.getImageData(0, 0, paddedWidth, paddedHeight).data;
  const paddedPixels = paddedWidth * paddedHeight;
  const field = new Float32Array(paddedPixels * 3);
  for (let i = 0; i < paddedPixels; i++) {
    const s = i * 4;
    // getImageData is unpremultiplied, so weighting by alpha recovers the
    // additive sum that the 'lighter' pass produced.
    const a = data[s + 3] / 255 / DRAW_HEADROOM;
    const o = i * 3;
    field[o] = data[s] * a;
    field[o + 1] = data[s + 1] * a;
    field[o + 2] = data[s + 2] * a;
  }

  blurRgbInPlace(field, paddedWidth, paddedHeight, sigma);

  // Only the light is written here. The background is added by the edge
  // falloff, which needs to attenuate the two by different amounts.
  const gain = composition.gain;
  for (let y = 0; y < height; y++) {
    let src = ((y + pad) * paddedWidth + pad) * 3;
    let dst = y * width * 3;
    for (let x = 0; x < width; x++) {
      rgb[dst] = softKnee(field[src] * gain);
      rgb[dst + 1] = softKnee(field[src + 1] * gain);
      rgb[dst + 2] = softKnee(field[src + 2] * gain);
      src += 3;
      dst += 3;
    }
  }
};

export const ColourField: React.FC = () => {
  const { register } = usePipeline();
  useLayoutEffect(() => {
    register({ order: STAGE_ORDER.colourField, run: renderColourField });
  }, [register]);
  return null;
};
