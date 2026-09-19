// Composites one frame: paints the background field and the foreground
// alert onto their own offscreen layers, then combines them through the
// glitch pass (slice tearing, chromatic split, signal drop).
//
// The offscreen canvases are allocated once by the component and handed
// back in on every frame, so a 452-frame render doesn't churn ~30 MB of
// canvas per frame at 4K.

import {
  activeBlooms,
  drawBloomGlow,
  drawCodeFragments,
  drawDigits,
  drawHeadlineText,
  drawMosaic,
  drawScanlines,
  drawTriangle,
  drawVignette,
  type Scene,
} from "./draw";
import { getGlitchState } from "./glitch";
import { hash2 } from "./random";

export type Layers = {
  background: HTMLCanvasElement;
  foreground: HTMLCanvasElement;
  /** Holds the sliced foreground during a glitch. */
  scratch: HTMLCanvasElement;
  /** Holds one colour-channel copy of the foreground during a glitch. */
  tint: HTMLCanvasElement;
};

type Band = { sy: number; sh: number; dx: number; dy: number; alpha: number };

/**
 * Turns the frame's overlapping slice list into a gap-free partition of
 * the frame height. Drawing a partition means every row is redrawn
 * exactly once, so torn rows cover their originals instead of ghosting
 * on top of them.
 */
const buildBands = (
  slices: ReturnType<typeof getGlitchState>["slices"],
  height: number,
): Band[] => {
  if (slices.length === 0) {
    return [{ sy: 0, sh: height, dx: 0, dy: 0, alpha: 1 }];
  }

  const edges = new Set<number>([0, height]);
  for (const s of slices) {
    edges.add(Math.round(s.y * height));
    edges.add(Math.round((s.y + s.h) * height));
  }
  const sorted = [...edges].sort((a, b) => a - b);

  const bands: Band[] = [];
  for (let i = 0; i < sorted.length - 1; i++) {
    const sy = sorted[i];
    const sh = sorted[i + 1] - sy;
    if (sh <= 0) continue;

    // Later slices win where they overlap.
    let dx = 0;
    let dy = 0;
    let alpha = 1;
    const mid = (sy + sh / 2) / height;
    for (const s of slices) {
      if (mid >= s.y && mid < s.y + s.h) {
        dx = s.dx;
        dy = s.dy;
        alpha = s.alpha;
      }
    }
    bands.push({ sy, sh, dx, dy, alpha });
  }
  return bands;
};

/** Masks `src` to a single colour channel, leaving the result in `scratch`. */
const tintToChannel = (
  scratch: CanvasRenderingContext2D,
  src: HTMLCanvasElement,
  color: string,
) => {
  const { width, height } = src;
  scratch.globalCompositeOperation = "source-over";
  scratch.globalAlpha = 1;
  scratch.clearRect(0, 0, width, height);
  scratch.drawImage(src, 0, 0);
  // `multiply` floods the transparent areas too...
  scratch.globalCompositeOperation = "multiply";
  scratch.fillStyle = color;
  scratch.fillRect(0, 0, width, height);
  // ...so re-apply the source's alpha to mask them back out.
  scratch.globalCompositeOperation = "destination-in";
  scratch.drawImage(src, 0, 0);
  scratch.globalCompositeOperation = "source-over";
};

export const renderFrame = (
  target: CanvasRenderingContext2D,
  layers: Layers,
  scene: Scene,
  headline: string,
) => {
  const { width, height } = scene;
  const glitch = getGlitchState(scene.frame);

  // --- Background layer --------------------------------------------------
  const bg = layers.background.getContext("2d")!;
  bg.setTransform(1, 0, 0, 1, 0, 0);
  bg.globalAlpha = 1;
  bg.globalCompositeOperation = "source-over";
  const blooms = activeBlooms(scene);
  drawMosaic(bg, scene, blooms);
  drawBloomGlow(bg, scene, blooms);
  drawCodeFragments(bg, scene);
  drawDigits(bg, scene);

  // --- Foreground layer --------------------------------------------------
  const fg = layers.foreground.getContext("2d")!;
  fg.setTransform(1, 0, 0, 1, 0, 0);
  fg.globalAlpha = 1;
  fg.globalCompositeOperation = "source-over";
  fg.clearRect(0, 0, width, height);

  // A permanent sub-pixel unsteadiness, so the alert never looks like a
  // still image pasted over moving noise.
  const idleX =
    Math.sin(scene.seconds * 2.3) * scene.scale * 0.8 +
    (hash2(scene.frame, 17) - 0.5) * scene.scale * 1.2;
  const idleY = Math.sin(scene.seconds * 1.7 + 1.2) * scene.scale * 0.6;

  // Ghost copies first, so the solid headline lands on top of them.
  for (const ghost of glitch.headlineGhosts) {
    fg.save();
    fg.globalAlpha = ghost.alpha;
    fg.translate(ghost.dx * scene.scale, ghost.dy * scene.scale);
    drawHeadlineText(fg, scene, headline);
    fg.restore();
  }
  fg.save();
  fg.translate(idleX, idleY);
  drawHeadlineText(fg, scene, headline);
  fg.restore();

  fg.save();
  fg.translate(idleX * 0.6, idleY * 0.6);
  drawTriangle(fg, scene);
  fg.restore();

  // --- Composite ---------------------------------------------------------
  target.setTransform(1, 0, 0, 1, 0, 0);
  target.globalCompositeOperation = "source-over";
  target.globalAlpha = 1;
  target.fillStyle = "#000000";
  target.fillRect(0, 0, width, height);

  const bands = buildBands(glitch.slices, height);
  const roll = glitch.roll * scene.scale;

  // Background, torn horizontally only. Displacing background bands
  // vertically (or rolling the whole field) opens black seams between
  // them, since nothing is drawn behind the field to fill the gap.
  for (const band of bands) {
    target.globalAlpha = glitch.backgroundGain * band.alpha;
    target.drawImage(
      layers.background,
      0,
      band.sy,
      width,
      band.sh,
      band.dx * width,
      band.sy,
      width,
      band.sh,
    );
  }
  target.globalAlpha = 1;

  if (glitch.foregroundAlpha > 0.01) {
    // Foreground, torn a little harder than the background so the alert
    // shreds against the field rather than moving with it.
    const scratch = layers.scratch.getContext("2d")!;
    let source = layers.foreground;

    if (glitch.slices.length > 0) {
      scratch.setTransform(1, 0, 0, 1, 0, 0);
      scratch.globalCompositeOperation = "source-over";
      scratch.globalAlpha = 1;
      scratch.clearRect(0, 0, width, height);
      for (const band of bands) {
        scratch.drawImage(
          layers.foreground,
          0,
          band.sy,
          width,
          band.sh,
          band.dx * width * 1.45,
          band.sy + band.dy * height,
          width,
          band.sh,
        );
      }
      source = layers.scratch;
    }

    target.globalAlpha = glitch.foregroundAlpha;
    target.drawImage(source, 0, roll);

    // Chromatic split: keep the solid element opaque and add red/blue
    // fringes either side of it. Doing it additively over the already
    // drawn foreground avoids the washed-out look of compositing three
    // separate channels from scratch.
    const split = glitch.rgbSplit * scene.scale;
    if (split > 0.5) {
      const tint = layers.tint.getContext("2d")!;
      tint.setTransform(1, 0, 0, 1, 0, 0);

      target.globalCompositeOperation = "lighter";
      target.globalAlpha = 0.85 * glitch.foregroundAlpha;

      tintToChannel(tint, source, "#ff0000");
      target.drawImage(layers.tint, -split, roll);

      tintToChannel(tint, source, "#00d0ff");
      target.drawImage(layers.tint, split, roll);

      target.globalCompositeOperation = "source-over";
    }
    target.globalAlpha = 1;
  }

  // --- Finishing ---------------------------------------------------------
  drawScanlines(target, scene);
  drawVignette(target, scene);
};
