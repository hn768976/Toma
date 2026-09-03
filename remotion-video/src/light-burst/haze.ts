import {
  HAZE_BLOBS,
  HAZE_BLUR,
  HAZE_DIVISOR,
  HAZE_WASHOUT,
  VIGNETTE_STRENGTH,
} from "./constants";
import { hexToRgb, rgba, type Rgb } from "./color";
import type { Palette } from "./palettes";

export type HazeColors = {
  base: Rgb;
  clouds: [Rgb, Rgb, Rgb];
};

export const hazeColors = (palette: Palette): HazeColors => ({
  base: hexToRgb(palette.base),
  clouds: [
    hexToRgb(palette.haze[0]),
    hexToRgb(palette.haze[1]),
    hexToRgb(palette.haze[2]),
  ],
});

/**
 * A soft radial falloff built from a computed ramp rather than two stops. The
 * squared-cosine profile has no discontinuity in its first derivative at
 * either end, which is what stops the cloud edges from showing a visible ring
 * once they are stacked additively.
 */
const softRadial = (
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  radius: number,
  color: Rgb,
  alpha: number,
) => {
  const g = ctx.createRadialGradient(x, y, 0, x, y, radius);
  const STOPS = 16;
  for (let i = 0; i <= STOPS; i++) {
    const t = i / STOPS;
    const falloff = Math.pow(0.5 + 0.5 * Math.cos(Math.PI * t), 1.15);
    g.addColorStop(t, rgba(color, alpha * falloff));
  }
  ctx.fillStyle = g;
  ctx.fillRect(x - radius, y - radius, radius * 2, radius * 2);
};

/**
 * Draws the background haze onto `target`.
 *
 * The clouds are drawn on a quarter-size offscreen canvas and then upscaled.
 * At full size these are 15-25%-of-frame-width blurs; doing that arithmetic at
 * 4K would dominate the frame budget for no visible gain, since the whole
 * layer is an out-of-focus gradient. Drawing small and letting the browser's
 * bilinear upscale do the last octave of smoothing is both cheaper and
 * smoother than blurring at full resolution.
 */
export const drawHaze = (
  target: CanvasRenderingContext2D,
  offscreen: HTMLCanvasElement,
  width: number,
  height: number,
  frame: number,
  colors: HazeColors,
  /**
   * Core brightness, 0..1. The flare's veiling glare washes the background
   * out: at peak the blue clouds are pushed to the edges and the frame is
   * essentially all warm light. Without this the cyan mass stays fully
   * saturated straight through the peak and the two layers read as separate
   * pictures stacked on top of each other rather than one exposure.
   */
  brightness: number,
) => {
  const ox = offscreen.getContext("2d");
  if (!ox) return;
  const ow = offscreen.width;
  const oh = offscreen.height;
  ox.setTransform(1, 0, 0, 1, 0, 0);
  ox.globalCompositeOperation = "source-over";
  ox.filter = "none";
  ox.clearRect(0, 0, ow, oh);

  // Base: the deep ground, lifted slightly toward the top-left and deepening
  // into the bottom-right corner.
  const base = ox.createLinearGradient(0, 0, ow, oh);
  base.addColorStop(0, rgba(colors.base, 1));
  base.addColorStop(1, rgba({ r: 1, g: 2, b: 6 }, 1));
  ox.fillStyle = base;
  ox.fillRect(0, 0, ow, oh);

  // Clouds, stacked additively so overlaps brighten the way defocused light
  // does rather than flattening the way alpha compositing would.
  ox.globalCompositeOperation = "lighter";
  ox.filter = `blur(${(HAZE_BLUR * ow) / 2}px)`;
  const wash = 1 - HAZE_WASHOUT * brightness;
  for (const blob of HAZE_BLOBS) {
    // Drift on looping sines. Every period divides the clip length, so the
    // haze is in exactly its frame-0 arrangement again at frame 270.
    const dx =
      blob.driftX * Math.sin((Math.PI * 2 * frame) / blob.periodX + blob.phase);
    const dy =
      blob.driftY *
      Math.sin((Math.PI * 2 * frame) / blob.periodY + blob.phase * 1.31);
    softRadial(
      ox,
      (blob.x + dx) * ow,
      (blob.y + dy) * oh,
      blob.radius * ow,
      colors.clouds[blob.color],
      blob.alpha * wash,
    );
  }
  ox.filter = "none";
  ox.globalCompositeOperation = "source-over";

  // Upscale onto the soft layer.
  target.setTransform(1, 0, 0, 1, 0, 0);
  target.globalCompositeOperation = "source-over";
  target.filter = "none";
  target.clearRect(0, 0, width, height);
  target.imageSmoothingEnabled = true;
  target.imageSmoothingQuality = "high";
  target.drawImage(offscreen, 0, 0, width, height);

  // Vignette. The reference falls off hard into all four corners, which is
  // what keeps the centre of frame reading as the brightest thing even before
  // the flare ignites.
  const v = target.createRadialGradient(
    width * 0.36,
    height * 0.34,
    0,
    width * 0.36,
    height * 0.34,
    Math.hypot(width, height) * 0.7,
  );
  v.addColorStop(0, "rgba(0,0,0,0)");
  v.addColorStop(0.55, "rgba(0,0,0,0)");
  v.addColorStop(1, `rgba(0,0,0,${VIGNETTE_STRENGTH})`);
  target.fillStyle = v;
  target.fillRect(0, 0, width, height);
};

export const hazeOffscreenSize = (softWidth: number, softHeight: number) => ({
  width: Math.round(softWidth / HAZE_DIVISOR),
  height: Math.round(softHeight / HAZE_DIVISOR),
});
