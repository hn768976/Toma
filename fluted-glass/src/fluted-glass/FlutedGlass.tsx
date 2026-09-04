import React, { useLayoutEffect, useMemo, useRef } from "react";
import { AbsoluteFill, useCurrentFrame, useVideoConfig } from "remotion";
import { z } from "zod";
import {
  AMBIENT_LIGHT,
  BLOOM_BLUR,
  BLOOM_DOWNSCALE,
  BLOOM_STRENGTH,
  GRAIN_TILE_COUNT,
  GRAIN_TILE_SIZE,
  HOT_GAIN,
  LIGHT_BLUR_FRACTION,
  LIGHT_LAYER_HEIGHT,
  LIGHT_LAYER_WIDTH,
  WASH_EDGE,
} from "./constants";
import { BLOOMS, PHASES, bloomStateAt } from "./blooms";
import { buildRibProfile } from "./ribs";
import { buildGrainTile } from "./grain";
import { PALETTES, toneColor, withAlpha } from "./palettes";
import { seededRandom } from "./random";

export const flutedGlassSchema = z.object({
  palette: z.enum(["blue", "gold", "mono"]),
});

export type FlutedGlassProps = z.infer<typeof flutedGlassSchema>;

// Roughly gaussian falloff for a bloom, as radial-gradient stops.
const BLOB_STOPS: [number, number][] = [
  [0, 1],
  [0.16, 0.87],
  [0.32, 0.63],
  [0.48, 0.41],
  [0.64, 0.22],
  [0.79, 0.09],
  [0.9, 0.03],
  [1, 0],
];

const createCanvas = (width: number, height: number) => {
  if (typeof document === "undefined") return null;
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  return canvas;
};

/** Turn a per-column profile into a 1px-tall canvas to be stretched vertically. */
const createStrip = (values: Float32Array) => {
  const strip = createCanvas(values.length, 1);
  const context = strip?.getContext("2d");
  if (!strip || !context) return null;

  const image = context.createImageData(values.length, 1);
  for (let x = 0; x < values.length; x++) {
    const v = Math.round(values[x] * 255);
    image.data[x * 4] = v;
    image.data[x * 4 + 1] = v;
    image.data[x * 4 + 2] = v;
    image.data[x * 4 + 3] = 255;
  }
  context.putImageData(image, 0, 0);
  return strip;
};

const createGrainTile = (index: number) => {
  const tile = createCanvas(GRAIN_TILE_SIZE, GRAIN_TILE_SIZE);
  const context = tile?.getContext("2d");
  if (!tile || !context) return null;
  const image = context.createImageData(GRAIN_TILE_SIZE, GRAIN_TILE_SIZE);
  image.data.set(buildGrainTile(index));
  context.putImageData(image, 0, 0);
  return tile;
};

/**
 * Fluted glass: soft blurred blooms drift across a near-black field, and a
 * fixed vertical rib pattern in front modulates them into highlights. Purely
 * 2D - no camera, no 3D - and everything is a pure function of (frame), so
 * Remotion can render frames out of order.
 */
export const FlutedGlass: React.FC<FlutedGlassProps> = ({ palette }) => {
  const frame = useCurrentFrame();
  const { width, height, durationInFrames } = useVideoConfig();
  const colors = PALETTES[palette];

  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Ribs are fixed geometry: the profile is built once per resolution and
  // never re-evaluated per frame.
  const ribs = useMemo(() => buildRibProfile(width), [width]);
  const shadingStrip = useMemo(() => createStrip(ribs.shading), [ribs]);
  const hotStrip = useMemo(() => createStrip(ribs.hot), [ribs]);

  const lightCanvas = useMemo(
    () => createCanvas(LIGHT_LAYER_WIDTH, LIGHT_LAYER_HEIGHT),
    [],
  );
  const blurCanvas = useMemo(
    () => createCanvas(LIGHT_LAYER_WIDTH, LIGHT_LAYER_HEIGHT),
    [],
  );
  const scratchCanvas = useMemo(
    () => createCanvas(width, height),
    [width, height],
  );
  const bloomCanvas = useMemo(
    () =>
      createCanvas(
        Math.round(width / BLOOM_DOWNSCALE),
        Math.round(height / BLOOM_DOWNSCALE),
      ),
    [width, height],
  );
  const grainTiles = useMemo(
    () =>
      Array.from({ length: GRAIN_TILE_COUNT }, (_, index) =>
        createGrainTile(index),
      ),
    [],
  );

  useLayoutEffect(() => {
    const canvas = canvasRef.current;
    if (
      !canvas ||
      !lightCanvas ||
      !blurCanvas ||
      !scratchCanvas ||
      !bloomCanvas ||
      !shadingStrip ||
      !hotStrip
    ) {
      return;
    }

    const ctx = canvas.getContext("2d");
    const lightCtx = lightCanvas.getContext("2d");
    const blurCtx = blurCanvas.getContext("2d");
    const scratchCtx = scratchCanvas.getContext("2d");
    const bloomCtx = bloomCanvas.getContext("2d");
    if (!ctx || !lightCtx || !blurCtx || !scratchCtx || !bloomCtx) return;

    const loop = ((frame % durationInFrames) + durationInFrames) % durationInFrames;
    const t = loop / durationInFrames;

    // 1. Light layer. Drawn small and additively; upscaling it to the frame
    //    later is itself a very wide blur that cannot band.
    lightCtx.setTransform(1, 0, 0, 1, 0, 0);
    lightCtx.globalCompositeOperation = "source-over";
    lightCtx.globalAlpha = 1;
    lightCtx.clearRect(0, 0, LIGHT_LAYER_WIDTH, LIGHT_LAYER_HEIGHT);
    lightCtx.globalCompositeOperation = "lighter";

    BLOOMS.forEach((bloom, index) => {
      const state = bloomStateAt(bloom, PHASES[index], t);
      const cx = state.x * LIGHT_LAYER_WIDTH;
      const cy = state.y * LIGHT_LAYER_HEIGHT;
      const radius = state.radius * LIGHT_LAYER_WIDTH;
      if (radius <= 0 || state.alpha <= 0) return;

      const gradient = lightCtx.createRadialGradient(cx, cy, 0, cx, cy, radius);
      const color = toneColor(colors, bloom.tone);
      for (const [stop, alpha] of BLOB_STOPS) {
        gradient.addColorStop(stop, withAlpha(color, Math.min(1, alpha * state.alpha)));
      }
      lightCtx.fillStyle = gradient;
      lightCtx.fillRect(cx - radius, cy - radius, radius * 2, radius * 2);
    });

    blurCtx.setTransform(1, 0, 0, 1, 0, 0);
    blurCtx.globalCompositeOperation = "source-over";
    blurCtx.globalAlpha = 1;
    blurCtx.clearRect(0, 0, LIGHT_LAYER_WIDTH, LIGHT_LAYER_HEIGHT);
    blurCtx.filter = `blur(${LIGHT_LAYER_WIDTH * LIGHT_BLUR_FRACTION}px)`;
    blurCtx.drawImage(lightCanvas, 0, 0);
    blurCtx.filter = "none";

    // 2 + 3. Rib shading (with its edge and specular lines) multiplied over
    //        the light layer: a rib only shows a bright band where a bloom
    //        sits behind it.
    const addModulatedPass = (strip: HTMLCanvasElement, alpha: number) => {
      scratchCtx.setTransform(1, 0, 0, 1, 0, 0);
      scratchCtx.globalCompositeOperation = "source-over";
      scratchCtx.globalAlpha = 1;
      scratchCtx.fillStyle = "#000000";
      scratchCtx.fillRect(0, 0, width, height);
      scratchCtx.imageSmoothingEnabled = true;
      scratchCtx.imageSmoothingQuality = "high";
      scratchCtx.drawImage(blurCanvas, 0, 0, width, height);

      // 1:1 horizontally, so every rib lands exactly where the profile put it.
      scratchCtx.imageSmoothingEnabled = false;
      scratchCtx.globalCompositeOperation = "multiply";
      scratchCtx.drawImage(strip, 0, 0, width, 1, 0, 0, width, height);

      ctx.globalCompositeOperation = "lighter";
      ctx.globalAlpha = alpha;
      ctx.drawImage(scratchCanvas, 0, 0);
      ctx.globalAlpha = 1;
    };

    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.globalCompositeOperation = "source-over";
    ctx.globalAlpha = 1;
    ctx.fillStyle = colors.base;
    ctx.fillRect(0, 0, width, height);

    addModulatedPass(shadingStrip, 1);
    addModulatedPass(hotStrip, HOT_GAIN);

    // A trace of unmodulated light, so the rib troughs read as deep tinted
    // shadow rather than as flat black.
    ctx.globalCompositeOperation = "lighter";
    ctx.globalAlpha = AMBIENT_LIGHT;
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(blurCanvas, 0, 0, width, height);
    ctx.globalAlpha = 1;

    // 4. Depth wash - slightly darker top and bottom.
    ctx.globalCompositeOperation = "multiply";
    const wash = ctx.createLinearGradient(0, 0, 0, height);
    const washColor = (v: number) => {
      const c = Math.round(v * 255);
      return `rgb(${c}, ${c}, ${c})`;
    };
    wash.addColorStop(0, washColor(WASH_EDGE));
    wash.addColorStop(0.16, washColor(0.88));
    wash.addColorStop(0.45, washColor(1));
    wash.addColorStop(0.6, washColor(1));
    wash.addColorStop(0.86, washColor(0.88));
    wash.addColorStop(1, washColor(WASH_EDGE));
    ctx.fillStyle = wash;
    ctx.fillRect(0, 0, width, height);

    // Slight bloom over the whole frame, enough to soften the specular lines.
    bloomCtx.setTransform(1, 0, 0, 1, 0, 0);
    bloomCtx.globalCompositeOperation = "source-over";
    bloomCtx.globalAlpha = 1;
    bloomCtx.clearRect(0, 0, bloomCanvas.width, bloomCanvas.height);
    bloomCtx.imageSmoothingEnabled = true;
    bloomCtx.imageSmoothingQuality = "high";
    bloomCtx.filter = `blur(${BLOOM_BLUR}px)`;
    bloomCtx.drawImage(canvas, 0, 0, bloomCanvas.width, bloomCanvas.height);
    bloomCtx.filter = "none";

    ctx.globalCompositeOperation = "lighter";
    ctx.globalAlpha = BLOOM_STRENGTH;
    ctx.imageSmoothingEnabled = true;
    ctx.drawImage(bloomCanvas, 0, 0, width, height);
    ctx.globalAlpha = 1;

    // Fine grain, so the smooth gradients between ribs do not band in H.264.
    const tile = grainTiles[loop % GRAIN_TILE_COUNT];
    if (tile) {
      const pattern = ctx.createPattern(tile, "repeat");
      if (pattern) {
        const offsetX = Math.floor(seededRandom(loop, 97) * GRAIN_TILE_SIZE);
        const offsetY = Math.floor(seededRandom(loop, 131) * GRAIN_TILE_SIZE);
        ctx.globalCompositeOperation = "lighter";
        ctx.translate(-offsetX, -offsetY);
        ctx.fillStyle = pattern;
        ctx.fillRect(0, 0, width + offsetX + GRAIN_TILE_SIZE, height + offsetY + GRAIN_TILE_SIZE);
        ctx.setTransform(1, 0, 0, 1, 0, 0);
      }
    }

    ctx.globalCompositeOperation = "source-over";
  }, [
    frame,
    durationInFrames,
    width,
    height,
    colors,
    lightCanvas,
    blurCanvas,
    scratchCanvas,
    bloomCanvas,
    shadingStrip,
    hotStrip,
    grainTiles,
  ]);

  return (
    <AbsoluteFill style={{ backgroundColor: colors.base }}>
      <canvas
        ref={canvasRef}
        width={width}
        height={height}
        style={{ display: "block", width: "100%", height: "100%" }}
      />
    </AbsoluteFill>
  );
};
