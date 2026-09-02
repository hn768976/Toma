import React, { useMemo } from "react";
import { withAlpha } from "../lib/color";
import { rnd, rndBiased, rndInt, rndRange, rndSigned } from "../lib/rand";
import { useCanvas } from "../lib/useCanvas";
import { paintCoreGlow } from "./CoreGlow";
import { FigureRaster, paintFigure, rasterizeFigure } from "./Figure";
import { layerStyle } from "./layers";
import { cameraDrift, coreGlowLevel, Layout, TAU } from "./layout";
import { VariantConfig } from "./variants";

/**
 * The foreground: a horizon line across the lower frame with the figure
 * seated on it, treated as pure silhouette in the same way the figure is.
 *
 * Two modes, chosen per variant:
 *
 *   "grass" — low irregular overlapping hills beyond the line, and a
 *   dense band of fine vertical strokes along it. The strokes are
 *   irregularly spaced on purpose: even spacing reads as a comb.
 *
 *   "water" — no hills, no band. A clean line with a soft reflection
 *   beneath it: a vertically mirrored, much dimmer, heavily blurred copy
 *   of the figure and the core glow, pushed around by a gentle
 *   horizontal ripple.
 */

type Blade = {
  x: number;
  height: number;
  width: number;
  lean: number;
  swayAmp: number;
  swayK: number;
  swayPhase: number;
};

type Hill = {
  cx: number;
  halfWidth: number;
  peak: number;
  wobbleAmp: number;
  wobbleK: number;
  wobblePhase: number;
};

const buildBlades = (layout: Layout, seedPrefix: string): Blade[] => {
  const blades: Blade[] = [];
  let x = -40;
  let i = 0;
  while (x < layout.width + 40 && i < 4000) {
    const seed = `${seedPrefix}:blade:${i}`;
    blades.push({
      x,
      height: rndBiased(`${seed}:h`, 22, 235, 1.6),
      width: rndRange(`${seed}:w`, 1.6, 4.2),
      lean: rndSigned(`${seed}:l`, 26),
      swayAmp: rndRange(`${seed}:sa`, 2.5, 9),
      swayK: rndInt(`${seed}:sk`, 1, 3),
      swayPhase: rnd(`${seed}:sp`) * TAU,
    });
    x += rndRange(`${seed}:gap`, 0.8, 3.9);
    i++;
  }
  return blades;
};

const buildHills = (layout: Layout, seedPrefix: string): Hill[] => {
  const hills: Hill[] = [];
  const count = 7;
  for (let i = 0; i < count; i++) {
    const seed = `${seedPrefix}:hill:${i}`;
    // Peaks are nudged away from frame centre so they never look like
    // they are slicing through the seated figure.
    const raw = rndRange(`${seed}:cx`, -0.15, 1.15);
    const pushed = raw < 0.5 ? raw - 0.14 : raw + 0.14;
    hills.push({
      cx: pushed * layout.width,
      halfWidth: rndRange(`${seed}:hw`, 0.11, 0.27) * layout.width,
      peak: rndRange(`${seed}:p`, 34, 186),
      wobbleAmp: rndRange(`${seed}:wa`, 6, 22),
      wobbleK: rndRange(`${seed}:wk`, 2.2, 5.4),
      wobblePhase: rnd(`${seed}:wp`) * TAU,
    });
  }
  return hills;
};

/** Hills + solid ground: static, so it is rasterised once and blitted. */
const buildGroundRaster = (
  layout: Layout,
  color: string,
  hills: Hill[],
): HTMLCanvasElement => {
  const c = document.createElement("canvas");
  c.width = layout.width;
  c.height = layout.height;
  const ctx = c.getContext("2d");
  if (!ctx) throw new Error("buildGroundRaster: no 2d context");
  ctx.fillStyle = color;

  for (const hill of hills) {
    ctx.beginPath();
    ctx.moveTo(hill.cx - hill.halfWidth, layout.height);
    const steps = 96;
    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
      const x = hill.cx + (t * 2 - 1) * hill.halfWidth;
      const dome = Math.pow(Math.cos((t * 2 - 1) * (Math.PI / 2)), 1.6);
      const wobble =
        hill.wobbleAmp *
        Math.sin(hill.wobbleK * (t * 2 - 1) * Math.PI + hill.wobblePhase) *
        dome;
      ctx.lineTo(x, layout.horizonY - hill.peak * dome - wobble);
    }
    ctx.lineTo(hill.cx + hill.halfWidth, layout.height);
    ctx.closePath();
    ctx.fill();
  }

  ctx.fillRect(0, layout.horizonY, layout.width, layout.height - layout.horizonY);
  return c;
};

type WaterBuffers = {
  refl: HTMLCanvasElement;
  reflBlur: HTMLCanvasElement;
  reflWarp: HTMLCanvasElement;
  scale: number;
};

/**
 * Vertical squash applied to the reflection.
 *
 * A true mirror would put the reflected core glow as far below the
 * horizon as the glow sits above it — which, with the light high in the
 * sky, is off the bottom of the frame, leaving only a dark figure-shaped
 * smudge in the water. Foreshortening the reflection is both what a
 * shallow viewing angle actually does and what brings the figure and the
 * glow back into the band of water there is room for.
 */
const REFLECTION_SQUASH = 0.55;

const buildWaterBuffers = (layout: Layout): WaterBuffers => {
  const scale = 0.5;
  const w = Math.max(1, Math.round(layout.width * scale));
  const h = Math.max(1, Math.round((layout.height - layout.horizonY) * scale));
  const make = () => {
    const c = document.createElement("canvas");
    c.width = w;
    c.height = h;
    return c;
  };
  return { refl: make(), reflBlur: make(), reflWarp: make(), scale };
};

const drawWater = (
  ctx: CanvasRenderingContext2D,
  config: VariantConfig,
  layout: Layout,
  frame: number,
  raster: FigureRaster | null,
  buffers: WaterBuffers,
): void => {
  const p = config.palette;
  const depth = layout.height - layout.horizonY;

  // The water surface itself: the sky's light stops at the line.
  const wash = ctx.createLinearGradient(0, layout.horizonY, 0, layout.height);
  wash.addColorStop(0, withAlpha(p.silhouette, 0.3));
  wash.addColorStop(0.35, withAlpha(p.silhouette, 0.6));
  wash.addColorStop(1, withAlpha(p.silhouette, 0.9));
  ctx.fillStyle = wash;
  ctx.fillRect(-20, layout.horizonY, layout.width + 40, depth + 20);

  if (!raster) return;

  // Build the mirrored copy. The transform flips about the horizon, so
  // everything below is drawn in ordinary world coordinates.
  const { refl, reflBlur, reflWarp, scale } = buffers;
  const rctx = refl.getContext("2d");
  const bctx = reflBlur.getContext("2d");
  const wctx = reflWarp.getContext("2d");
  if (!rctx || !bctx || !wctx) return;
  rctx.setTransform(1, 0, 0, 1, 0, 0);
  rctx.globalAlpha = 1;
  rctx.globalCompositeOperation = "source-over";
  rctx.filter = "none";
  rctx.clearRect(0, 0, refl.width, refl.height);
  const sq = scale * REFLECTION_SQUASH;
  rctx.setTransform(scale, 0, 0, -sq, 0, sq * layout.horizonY);

  const level = coreGlowLevel(frame, config.coreGlow.mode);
  paintCoreGlow(rctx, {
    x: layout.originX,
    y: layout.originY,
    radius:
      layout.coreRadius *
      (config.coreGlow.mode === "accumulate"
        ? 0.72 + 0.3 * level
        : 0.97 + 0.03 * level),
    config,
    level,
  });

  // The figure is a hole in the light here too: punching it out of the
  // reflected glow is what makes the reflection read as the same scene
  // rather than a separate dark shape laid on top.
  rctx.globalCompositeOperation = "destination-out";
  paintFigure(rctx, raster, layout, frame);
  rctx.setTransform(1, 0, 0, 1, 0, 0);
  rctx.globalCompositeOperation = "source-over";

  bctx.setTransform(1, 0, 0, 1, 0, 0);
  bctx.globalAlpha = 1;
  bctx.globalCompositeOperation = "source-over";
  bctx.clearRect(0, 0, reflBlur.width, reflBlur.height);
  bctx.filter = "blur(11px)";
  bctx.drawImage(refl, 0, 0);
  bctx.filter = "none";

  // Ripple: re-lay the blurred reflection band by band with a small
  // horizontal offset. The warp is assembled in its own buffer with
  // ordinary source-over compositing and blitted ONCE — shifting bands
  // straight onto the frame with 'lighter' makes every overlap between
  // neighbouring bands a bright seam, which reads as horizontal banding
  // across the water.
  //
  // Both ripple frequencies are whole cycles per loop, so the water is
  // exactly where it started at frame 600.
  wctx.setTransform(1, 0, 0, 1, 0, 0);
  wctx.globalAlpha = 1;
  wctx.globalCompositeOperation = "source-over";
  wctx.filter = "none";
  wctx.clearRect(0, 0, reflWarp.width, reflWarp.height);
  const bandSrc = 2;
  const bands = Math.ceil(reflBlur.height / bandSrc);
  for (let b = 0; b < bands; b++) {
    const sy = b * bandSrc;
    const sh = Math.min(bandSrc, reflBlur.height - sy);
    if (sh <= 0) break;
    const t = sy / reflBlur.height;
    const amp = (5 + 58 * t) * scale;
    const dx =
      amp * Math.sin(t * 13.5 + (TAU * 2 * frame) / 600) +
      amp * 0.45 * Math.sin(t * 27 - (TAU * 3 * frame) / 600);
    wctx.drawImage(
      reflBlur,
      0,
      sy,
      reflBlur.width,
      sh,
      dx,
      sy,
      reflBlur.width,
      sh,
    );
  }

  // Fade the reflection out with depth.
  const fade = wctx.createLinearGradient(0, 0, 0, reflWarp.height);
  fade.addColorStop(0, "rgba(0, 0, 0, 1)");
  fade.addColorStop(0.62, "rgba(0, 0, 0, 0.55)");
  fade.addColorStop(1, "rgba(0, 0, 0, 0)");
  wctx.globalCompositeOperation = "destination-in";
  wctx.fillStyle = fade;
  wctx.fillRect(0, 0, reflWarp.width, reflWarp.height);
  wctx.globalCompositeOperation = "source-over";

  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  ctx.globalAlpha = 1;
  ctx.drawImage(
    reflWarp,
    0,
    layout.horizonY,
    layout.width,
    layout.height - layout.horizonY,
  );
  ctx.restore();

  // A clean, quiet horizon line.
  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  const line = ctx.createLinearGradient(0, 0, layout.width, 0);
  line.addColorStop(0, withAlpha(p.filamentDeep, 0));
  line.addColorStop(0.5, withAlpha(p.coreMid, 0.42));
  line.addColorStop(1, withAlpha(p.filamentDeep, 0));
  ctx.fillStyle = line;
  ctx.fillRect(0, layout.horizonY - 1.5, layout.width, 3);
  ctx.restore();
};

const drawGrass = (
  ctx: CanvasRenderingContext2D,
  config: VariantConfig,
  layout: Layout,
  frame: number,
  ground: HTMLCanvasElement,
  blades: Blade[],
): void => {
  // The whole layer is translated by the ambient drift, so the solid
  // ground is over-filled past the frame edges to avoid a sliver of
  // background appearing at the bottom.
  ctx.fillStyle = config.palette.silhouette;
  ctx.fillRect(
    -20,
    layout.horizonY,
    layout.width + 40,
    layout.height - layout.horizonY + 20,
  );
  ctx.drawImage(ground, 0, 0);
  for (const blade of blades) {
    const sway =
      blade.swayAmp * Math.sin((TAU * blade.swayK * frame) / 600 + blade.swayPhase);
    const tipX = blade.x + blade.lean + sway;
    const tipY = layout.horizonY - blade.height;
    const midX = blade.x + (blade.lean + sway) * 0.35;
    const midY = layout.horizonY - blade.height * 0.55;
    ctx.beginPath();
    ctx.moveTo(blade.x - blade.width, layout.horizonY + 6);
    ctx.quadraticCurveTo(midX - blade.width * 0.45, midY, tipX, tipY);
    ctx.quadraticCurveTo(
      midX + blade.width * 0.45,
      midY,
      blade.x + blade.width,
      layout.horizonY + 6,
    );
    ctx.closePath();
    ctx.fill();
  }
};

export const HorizonLine: React.FC<{
  config: VariantConfig;
  layout: Layout;
  frame: number;
  image: HTMLImageElement | null;
  seed: string;
}> = ({ config, layout, frame, image, seed }) => {
  const grass = config.foreground === "grass";

  const blades = useMemo(
    () => (grass ? buildBlades(layout, seed) : []),
    [grass, layout, seed],
  );
  const ground = useMemo(
    () =>
      grass
        ? buildGroundRaster(
            layout,
            config.palette.silhouette,
            buildHills(layout, seed),
          )
        : null,
    [grass, layout, config.palette.silhouette, seed],
  );
  const waterBuffers = useMemo(
    () => (grass ? null : buildWaterBuffers(layout)),
    [grass, layout],
  );
  const raster = useMemo(
    () =>
      image && !grass
        ? rasterizeFigure(
            image,
            layout.figureWidth,
            layout.figureHeight,
            config.palette.silhouette,
          )
        : null,
    [image, grass, layout.figureWidth, layout.figureHeight, config.palette.silhouette],
  );

  const ref = useCanvas(layout.width, layout.height, (ctx) => {
    const drift = cameraDrift(frame);
    ctx.save();
    ctx.translate(drift.x, drift.y);
    if (grass && ground) {
      drawGrass(ctx, config, layout, frame, ground, blades);
    } else if (waterBuffers) {
      drawWater(ctx, config, layout, frame, raster, waterBuffers);
    }
    ctx.restore();
  });

  return <canvas ref={ref} style={layerStyle("normal")} />;
};
