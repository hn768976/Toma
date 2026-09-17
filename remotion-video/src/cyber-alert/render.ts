// The frame painter.
//
// Pipeline, in order:
//   1. dots   - every LED on the panel, projected into perspective
//   2. bloom  - two blurred downscales added back, for the glow
//   3. split  - the scene reassembled from a red and a cyan copy, which
//                are offset against each other during a glitch
//   4. bands  - horizontal slices displaced and torn
//   5. grade  - scanlines, vignette, dropout
//
// renderFrame is a pure function of `frame`: nothing accumulates between
// calls. Remotion renders frames out of order across worker processes, so
// any state carried forward would desynchronise the output.

import { hash01 } from "../lib/random";
import {
  BACKGROUND,
  DATA_CELL_W,
  HEADLINE_CELL_W,
  DOT_RADIUS,
  DOT_UNLIT,
  ROW_MAX,
  ROW_MIN,
  ROW_PITCH,
  WALL_U_HALF,
  type Variant,
} from "./constants";
import { cameraAt, makeProjector } from "./camera";
import { dataCharAt, headlineCharAt, rowScrollDots } from "./content";
import { GLYPH_H, getGlyph } from "./font5x7";
import { glitchAt } from "./glitch";
import { SPRITES } from "./icons";
import { computeLayout, type Layout } from "./layout";
import {
  alertColors,
  alertHotColors,
  dataColors,
  HUE_BUCKETS,
  levelIndex,
} from "./palette";

export type Scratch = {
  width: number;
  height: number;
  dots: HTMLCanvasElement;
  scene: HTMLCanvasElement;
  bloomNear: HTMLCanvasElement;
  bloomFar: HTMLCanvasElement;
  defocus: HTMLCanvasElement;
  tintR: HTMLCanvasElement;
  tintC: HTMLCanvasElement;
};

const makeCanvas = (width: number, height: number) => {
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(width));
  canvas.height = Math.max(1, Math.round(height));
  return canvas;
};

export const createScratch = (width: number, height: number): Scratch => ({
  width,
  height,
  dots: makeCanvas(width, height),
  scene: makeCanvas(width, height),
  bloomNear: makeCanvas(width / 3, height / 3),
  bloomFar: makeCanvas(width / 8, height / 8),
  defocus: makeCanvas(width / 2, height / 2),
  tintR: makeCanvas(width, height),
  tintC: makeCanvas(width, height),
});

const context2d = (canvas: HTMLCanvasElement) => {
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("2D canvas context unavailable");
  return ctx;
};

const reset = (ctx: CanvasRenderingContext2D) => {
  ctx.globalCompositeOperation = "source-over";
  ctx.globalAlpha = 1;
  ctx.filter = "none";
};

// --- Stage 1: the LED panel -------------------------------------------

const PANEL_V_TOP = ROW_MIN * ROW_PITCH - 6;
const PANEL_V_BOTTOM = ROW_MAX * ROW_PITCH + GLYPH_H + 6;

const paintPanel = (
  ctx: CanvasRenderingContext2D,
  frame: number,
  width: number,
  height: number,
  variant: Variant,
  layout: Layout,
) => {
  const glitch = glitchAt(frame);
  const camera = cameraAt(frame, glitch, layout);
  const projector = makeProjector(camera, width, height);

  ctx.fillStyle = BACKGROUND;
  ctx.fillRect(0, 0, width, height);

  const margin = 40;
  const nominalScale = (width / 1920) * 19.6;

  // 1a. The unlit substrate. Drawing every dark LED, not just the lit
  // ones, is what gives the wall its physical grain and its moire as the
  // camera turns.
  ctx.fillStyle = DOT_UNLIT;
  for (let v = PANEL_V_TOP; v <= PANEL_V_BOTTOM; v++) {
    for (let u = -WALL_U_HALF; u <= WALL_U_HALF; u++) {
      projector.project(u, v);
      if (!projector.visible) continue;
      const { x, y, scale } = projector;
      if (x < -margin || x > width + margin) continue;
      if (y < -margin || y > height + margin) continue;
      const size = DOT_RADIUS * 2 * scale;
      ctx.fillRect(x - size / 2, y - size / 2, size, size);
    }
  }

  // 1b. Lit dots.
  const data = dataColors();
  const alert = alertColors(variant.alertHue);
  const alertHot = alertHotColors(variant.alertHue);

  const dot = (u: number, v: number, color: string) => {
    projector.project(u, v);
    if (!projector.visible) return;
    const { x, y, scale } = projector;
    if (x < -margin || x > width + margin) return;
    if (y < -margin || y > height + margin) return;
    const size = DOT_RADIUS * 2 * scale;
    ctx.fillStyle = color;
    ctx.fillRect(x - size / 2, y - size / 2, size, size);
  };

  // Shared per-dot modulation: a little live shimmer, plus a depth
  // falloff so receding dots sit back instead of staying uniformly hot.
  const brightnessAt = (u: number, v: number, base: number) => {
    const shimmer = hash01(u * 73 + v, Math.floor(frame / 3), 59) * 0.16 - 0.08;
    const depth = projector.scale / nominalScale;
    const falloff = depth < 0.55 ? 0.55 : depth > 1.15 ? 1.15 : depth;
    return base * falloff + shimmer;
  };

  const drawChar = (
    char: string,
    originU: number,
    originV: number,
    bold: boolean,
    pick: (u: number, v: number) => string,
  ) => {
    const glyph = getGlyph(char, bold);
    for (let gy = 0; gy < GLYPH_H; gy++) {
      const mask = glyph.rows[gy];
      if (mask === 0) continue;
      for (let gx = 0; gx < glyph.width; gx++) {
        if ((mask & (1 << gx)) === 0) continue;
        const u = originU + gx;
        const v = originV + gy;
        projector.project(u, v);
        if (!projector.visible) continue;
        const { x, y, scale } = projector;
        if (x < -margin || x > width + margin) continue;
        if (y < -margin || y > height + margin) continue;
        const size = DOT_RADIUS * 2 * scale;
        ctx.fillStyle = pick(u, v);
        ctx.fillRect(x - size / 2, y - size / 2, size, size);
      }
    }
  };

  // Data rows.
  for (let row = ROW_MIN; row <= ROW_MAX; row++) {
    const rowV = row * ROW_PITCH;
    const shift = rowScrollDots(row, frame);
    const first = Math.ceil((-WALL_U_HALF - shift) / DATA_CELL_W);
    const last = Math.floor((WALL_U_HALF - shift) / DATA_CELL_W);
    const isHeadlineRow = row === 0 || row === 1;

    for (let cell = first; cell <= last; cell++) {
      const cellU = cell * DATA_CELL_W + shift;
      // Leave the headline its clearance on the two rows it occupies.
      if (
        isHeadlineRow &&
        cellU + DATA_CELL_W > layout.reservedU0 &&
        cellU < layout.reservedU1
      ) {
        continue;
      }
      const char = dataCharAt(row, cell, frame, glitch.scramble);
      if (char === " ") continue;
      const bucket = Math.floor(hash01(row, cell, 3) * HUE_BUCKETS) % HUE_BUCKETS;
      drawChar(char, cellU, rowV, false, (u, v) => {
        const base = 0.42 + hash01(row, cell, 9) * 0.30;
        return data[bucket][levelIndex(brightnessAt(u, v, base))];
      });
    }
  }

  // Headline text.
  for (let line = 0; line < 2; line++) {
    const text = variant.lines[line];
    const lineV = layout.lineV[line];
    for (let i = 0; i < text.length; i++) {
      const char = headlineCharAt(line, i, text[i], frame, glitch.scramble);
      if (char === " ") continue;
      drawChar(char, layout.textU + i * HEADLINE_CELL_W, lineV, true, (u, v) =>
        alert[levelIndex(brightnessAt(u, v, 0.86))],
      );
    }
  }

  // Icon.
  const sprite = SPRITES[variant.sprite];
  for (let sy = 0; sy < sprite.height; sy++) {
    const cells = sprite.cells[sy];
    for (let sx = 0; sx < sprite.width; sx++) {
      let cell = cells[sx];
      if (cell === 0) continue;
      const u = layout.iconU + sx;
      const v = layout.iconV + sy;
      // The badge takes damage in a burst too: dots drop out and hot
      // cores flare, so the icon degrades with the rest of the panel.
      if (glitch.scramble > 0) {
        const tick = Math.floor(frame / 2);
        const roll = hash01(sx * 37 + sy * 101, tick, 67);
        if (roll < glitch.scramble * 0.28) continue;
        if (roll > 1 - glitch.scramble * 0.12) cell = 2;
      }
      projector.project(u, v);
      const base = cell === 2 ? 0.95 : 0.82;
      const table = cell === 2 ? alertHot : alert;
      dot(u, v, table[levelIndex(brightnessAt(u, v, base))]);
    }
  }

  return glitch;
};

// --- Stage 2: bloom ----------------------------------------------------

const applyBloom = (scratch: Scratch, scale: number) => {
  const { width, height, dots, scene, bloomNear, bloomFar } = scratch;
  const nearCtx = context2d(bloomNear);
  const farCtx = context2d(bloomFar);
  const sceneCtx = context2d(scene);

  reset(nearCtx);
  nearCtx.clearRect(0, 0, bloomNear.width, bloomNear.height);
  nearCtx.filter = `blur(${(1.6 * scale).toFixed(2)}px)`;
  nearCtx.drawImage(dots, 0, 0, bloomNear.width, bloomNear.height);

  reset(farCtx);
  farCtx.clearRect(0, 0, bloomFar.width, bloomFar.height);
  farCtx.filter = `blur(${(2.4 * scale).toFixed(2)}px)`;
  farCtx.drawImage(dots, 0, 0, bloomFar.width, bloomFar.height);

  reset(sceneCtx);
  sceneCtx.drawImage(dots, 0, 0);
  sceneCtx.globalCompositeOperation = "lighter";
  sceneCtx.globalAlpha = 0.58;
  sceneCtx.drawImage(bloomNear, 0, 0, width, height);
  sceneCtx.globalAlpha = 0.42;
  sceneCtx.drawImage(bloomFar, 0, 0, width, height);
  reset(sceneCtx);
};

// --- Stage 3/4: channel split and band displacement --------------------

const tint = (
  target: HTMLCanvasElement,
  source: HTMLCanvasElement,
  color: string,
) => {
  const ctx = context2d(target);
  reset(ctx);
  ctx.clearRect(0, 0, target.width, target.height);
  ctx.drawImage(source, 0, 0);
  ctx.globalCompositeOperation = "multiply";
  ctx.fillStyle = color;
  ctx.fillRect(0, 0, target.width, target.height);
  reset(ctx);
  return target;
};

const compose = (
  ctx: CanvasRenderingContext2D,
  scratch: Scratch,
  glitch: ReturnType<typeof glitchAt>,
) => {
  const { width, height, scene } = scratch;
  reset(ctx);
  ctx.fillStyle = "#000000";
  ctx.fillRect(0, 0, width, height);

  if (!glitch.active) {
    ctx.drawImage(scene, 0, 0);
    return;
  }

  // Red and cyan sum back to the original image, so at zero offset this
  // is lossless — the split only appears as the two are pulled apart.
  const red = tint(scratch.tintR, scene, "#ff0000");
  const cyan = tint(scratch.tintC, scene, "#00ffff");

  const k = glitch.intensity;
  const step = glitch.step;
  const split = k * width * 0.011;
  const bands = 12 + Math.floor(k * 26);
  const bandHeight = height / bands;
  const maxShift = width * 0.13;

  ctx.globalCompositeOperation = "lighter";

  for (let band = 0; band < bands; band++) {
    const y = band * bandHeight;
    const h = Math.ceil(bandHeight) + 1;
    const roll = hash01(step, band, 19);

    // Most bands stay put. Displacing all of them reads as a wobble;
    // displacing a few reads as tearing.
    const shift = roll < 0.45 ? 0 : (hash01(step, band, 23) - 0.5) * maxShift * k;

    // A handful of bands also sample the wrong scanline, so the image
    // tears vertically as well as sideways.
    const tearRoll = hash01(step, band, 29);
    const srcY =
      tearRoll < 0.12 ? y + (hash01(step, band, 31) - 0.5) * height * 0.08 : y;
    const clampedSrcY = Math.max(0, Math.min(height - h, srcY));

    const ghosts = k > 0.5 && shift !== 0 ? 3 : 1;
    for (let g = 0; g < ghosts; g++) {
      const spread = g === 0 ? 1 : 1 + g * 0.6;
      ctx.globalAlpha = g === 0 ? 1 : 0.3 / g;
      ctx.drawImage(
        red, 0, clampedSrcY, width, h,
        shift * spread + split, y, width, h,
      );
      ctx.drawImage(
        cyan, 0, clampedSrcY, width, h,
        shift * spread - split, y, width, h,
      );
    }
  }
  reset(ctx);
};

// --- Stage 4b: edge defocus -------------------------------------------

// A real lens pointed at a wall this close cannot hold the whole panel in
// focus — the corners, which are physically further away, go soft. Laying
// a blurred copy back over the frame through a radial mask is what makes
// the shot read as footage of a screen rather than as a render of one.
const applyDefocus = (
  ctx: CanvasRenderingContext2D,
  scratch: Scratch,
  scale: number,
) => {
  const { width, height, defocus } = scratch;
  const dw = defocus.width;
  const dh = defocus.height;
  const dctx = context2d(defocus);

  reset(dctx);
  dctx.clearRect(0, 0, dw, dh);
  dctx.filter = `blur(${(1.8 * scale).toFixed(2)}px)`;
  // Sampled from the output, so the defocus sits on top of the glitch
  // rather than under it.
  dctx.drawImage(ctx.canvas, 0, 0, dw, dh);
  dctx.filter = "none";

  // Punch the sharp centre back out of the blurred copy.
  const mask = dctx.createRadialGradient(
    dw / 2, dh / 2, Math.min(dw, dh) * 0.36,
    dw / 2, dh / 2, Math.max(dw, dh) * 0.74,
  );
  mask.addColorStop(0, "rgba(0, 0, 0, 0)");
  mask.addColorStop(1, "rgba(0, 0, 0, 1)");
  dctx.globalCompositeOperation = "destination-in";
  dctx.fillStyle = mask;
  dctx.fillRect(0, 0, dw, dh);
  reset(dctx);

  ctx.drawImage(defocus, 0, 0, width, height);
};

// --- Stage 5: grade ----------------------------------------------------

const grade = (
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  frame: number,
  glitch: ReturnType<typeof glitchAt>,
  scale: number,
) => {
  reset(ctx);

  if (glitch.active) {
    // Scanlines only appear when the signal breaks up — a clean panel
    // shot on a clean sensor has none.
    const pitch = Math.max(2, Math.round(3 * scale));
    ctx.fillStyle = `rgba(0, 0, 0, ${(0.3 * glitch.intensity).toFixed(3)})`;
    for (let y = 0; y < height; y += pitch * 2) {
      ctx.fillRect(0, y, width, pitch);
    }

    // Dropout: a few blown-out rows where the panel loses sync.
    const dropouts = Math.floor(glitch.intensity * 5);
    for (let i = 0; i < dropouts; i++) {
      const y = hash01(glitch.step, i, 43) * height;
      const h = (2 + hash01(glitch.step, i, 47) * 10) * scale;
      ctx.fillStyle = `rgba(${180 + Math.floor(hash01(glitch.step, i, 53) * 75)}, 235, 255, ${(
        0.05 + hash01(glitch.step, i, 59) * 0.12
      ).toFixed(3)})`;
      ctx.fillRect(0, y, width, h);
    }
  }

  // Vignette. The panel is brighter than the room, so the corners fall
  // away hard.
  const vignette = ctx.createRadialGradient(
    width / 2, height / 2, Math.min(width, height) * 0.22,
    width / 2, height / 2, Math.max(width, height) * 0.74,
  );
  vignette.addColorStop(0, "rgba(0, 0, 0, 0)");
  vignette.addColorStop(1, "rgba(0, 0, 0, 0.72)");
  ctx.fillStyle = vignette;
  ctx.fillRect(0, 0, width, height);

  // Sensor grain, held very low so it lives under the dot structure.
  ctx.globalAlpha = 0.035;
  ctx.globalCompositeOperation = "lighter";
  const grainStep = Math.max(3, Math.round(4 * scale));
  for (let y = 0; y < height; y += grainStep) {
    const n = hash01(Math.floor(y / grainStep), frame, 71);
    if (n < 0.86) continue;
    ctx.fillStyle = "#4a7fd0";
    ctx.fillRect(0, y, width, 1);
  }
  reset(ctx);
};

// --- Entry point -------------------------------------------------------

export const renderFrame = (
  ctx: CanvasRenderingContext2D,
  scratch: Scratch,
  frame: number,
  variant: Variant,
) => {
  const { width, height } = scratch;
  const scale = width / 1920;
  const layout = computeLayout(variant);

  const dotsCtx = context2d(scratch.dots);
  reset(dotsCtx);
  const glitch = paintPanel(dotsCtx, frame, width, height, variant, layout);

  applyBloom(scratch, scale);
  compose(ctx, scratch, glitch);
  applyDefocus(ctx, scratch, scale);
  grade(ctx, width, height, frame, glitch, scale);
};
