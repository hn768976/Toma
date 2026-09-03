import React, { useMemo } from "react";
import { withAlpha } from "../lib/color";
import { HorizonSilhouette } from "../lib/HorizonSilhouette";
import { useCanvas } from "../lib/useCanvas";
import { paintCoreGlow } from "./CoreGlow";
import { FigureRaster, paintFigure, rasterizeFigure } from "./Figure";
import { layerStyle } from "./layers";
import { cameraDrift, coreGlowLevel, Layout, LOOP, TAU } from "./layout";
import { VariantConfig } from "./variants";

/**
 * The foreground: a horizon line across the lower frame with the figure
 * seated on it, treated as pure silhouette in the same way the figure is.
 *
 * The variant's `foreground` says which parts are present rather than
 * naming a single mode, because they combine:
 *
 *   hills + plants + ground — a bank: low irregular overlapping hills
 *   beyond the line and a dense band of fine vertical strokes along it,
 *   both delegated to the library's <HorizonSilhouette>.
 *
 *   reflection — a waterline: below it, a vertically mirrored, much
 *   dimmer, heavily blurred copy of the figure and the core glow, pushed
 *   around by a gentle horizontal ripple.
 *
 * The cool variant takes both: reeds standing at the edge of still
 * water. The plant band draws over the water layer, so the reeds sit in
 * front of the reflection instead of floating above it.
 */

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
  // exactly where it started at the end of the loop.
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
      amp * Math.sin(t * 13.5 + (TAU * 2 * frame) / LOOP) +
      amp * 0.45 * Math.sin(t * 27 - (TAU * 3 * frame) / LOOP);
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

  // Fade the reflection out with depth. This is an alpha mask applied
  // through 'destination-in', so only the alpha of these stops is read —
  // the rgb is inert and carries no palette meaning.
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

export const HorizonLine: React.FC<{
  config: VariantConfig;
  layout: Layout;
  frame: number;
  image: HTMLImageElement | null;
  seed: string;
}> = ({ config, layout, frame, image, seed }) => {
  const fg = config.foreground;
  const drift = cameraDrift(frame);

  const waterBuffers = useMemo(
    () => (fg.reflection ? buildWaterBuffers(layout) : null),
    [fg.reflection, layout],
  );
  const raster = useMemo(
    () =>
      image && fg.reflection
        ? rasterizeFigure(
            image,
            layout.figureWidth,
            layout.figureHeight,
            config.palette.silhouette,
          )
        : null,
    [
      image,
      fg.reflection,
      layout.figureWidth,
      layout.figureHeight,
      config.palette.silhouette,
    ],
  );

  // Memoised so <HorizonSilhouette> keeps its blade list and ground
  // raster across frames instead of rebuilding both every frame.
  const hillOptions = useMemo(() => (fg.hills ? {} : null), [fg.hills]);
  const bladeOptions = useMemo(() => (fg.plants ? {} : null), [fg.plants]);

  const ref = useCanvas(layout.width, layout.height, (ctx) => {
    if (!waterBuffers) return;
    ctx.save();
    ctx.translate(drift.x, drift.y);
    drawWater(ctx, config, layout, frame, raster, waterBuffers);
    ctx.restore();
  });

  return (
    <>
      {waterBuffers ? <canvas ref={ref} style={layerStyle("normal")} /> : null}
      {fg.hills || fg.plants || fg.ground ? (
        <HorizonSilhouette
          width={layout.width}
          height={layout.height}
          horizonY={layout.horizonY}
          color={config.palette.silhouette}
          frame={frame}
          loopLength={LOOP}
          seed={seed}
          hills={hillOptions}
          blades={bladeOptions}
          ground={fg.ground}
          offset={drift}
          style={layerStyle("normal")}
        />
      ) : null}
    </>
  );
};
