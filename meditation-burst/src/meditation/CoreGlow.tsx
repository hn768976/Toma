import React from "react";
import { bloomPass } from "../lib/bloomPass";
import { withAlpha } from "../lib/color";
import { useCanvas } from "../lib/useCanvas";
import { layerStyle } from "./layers";
import { cameraDrift, coreGlowLevel, Layout } from "./layout";
import { VariantConfig } from "./variants";

/**
 * Paints the intense radial glow that sits behind the figure's head:
 * layered gradients running from near-white at the centre, through the
 * palette's hues, out to transparent, over roughly 30% of frame height.
 *
 * Exported separately from the component because the water foreground
 * has to reflect the very same glow.
 */
export const paintCoreGlow = (
  ctx: CanvasRenderingContext2D,
  opts: {
    x: number;
    y: number;
    radius: number;
    config: VariantConfig;
    /** Brightness multiplier; 1 is nominal. */
    level: number;
  },
): void => {
  const { x, y, radius, config, level } = opts;
  const p = config.palette;
  const k = level * config.coreGlow.intensity;
  const a = (v: number) => Math.min(1, v * k);

  ctx.save();
  ctx.globalCompositeOperation = "lighter";

  // Broad outer bloom, well past the nominal radius.
  const wideR = radius * 1.95;
  const wide = ctx.createRadialGradient(x, y, 0, x, y, wideR);
  wide.addColorStop(0, withAlpha(p.coreMid, a(0.3)));
  wide.addColorStop(0.28, withAlpha(p.filamentMid, a(0.17)));
  wide.addColorStop(0.62, withAlpha(p.filamentDeep, a(0.075)));
  wide.addColorStop(1, withAlpha(p.filamentDeep, 0));
  ctx.fillStyle = wide;
  ctx.beginPath();
  ctx.arc(x, y, wideR, 0, Math.PI * 2);
  ctx.fill();

  // The body of the glow.
  const main = ctx.createRadialGradient(x, y, 0, x, y, radius);
  main.addColorStop(0, withAlpha(p.coreWhite, a(0.58)));
  main.addColorStop(0.1, withAlpha(p.coreWhite, a(0.42)));
  main.addColorStop(0.26, withAlpha(p.coreMid, a(0.34)));
  main.addColorStop(0.55, withAlpha(p.filamentMid, a(0.16)));
  main.addColorStop(0.8, withAlpha(p.filamentDeep, a(0.08)));
  main.addColorStop(1, withAlpha(p.filamentDeep, 0));
  ctx.fillStyle = main;
  ctx.beginPath();
  ctx.arc(x, y, radius, 0, Math.PI * 2);
  ctx.fill();

  // The hot centre — the part the head is meant to eat into.
  const hotR = radius * 0.22;
  const hot = ctx.createRadialGradient(x, y, 0, x, y, hotR);
  hot.addColorStop(0, withAlpha(p.coreWhite, a(0.72)));
  hot.addColorStop(0.45, withAlpha(p.coreWhite, a(0.4)));
  hot.addColorStop(1, withAlpha(p.coreMid, 0));
  ctx.fillStyle = hot;
  ctx.beginPath();
  ctx.arc(x, y, hotR, 0, Math.PI * 2);
  ctx.fill();

  ctx.restore();
};

export const CoreGlow: React.FC<{
  config: VariantConfig;
  layout: Layout;
  frame: number;
}> = ({ config, layout, frame }) => {
  const ref = useCanvas(layout.width, layout.height, (ctx) => {
    const drift = cameraDrift(frame);
    const level = coreGlowLevel(frame, config.coreGlow.mode);
    ctx.save();
    ctx.translate(drift.x, drift.y);
    paintCoreGlow(ctx, {
      x: layout.originX,
      y: layout.originY,
      // A steady breath moves brightness and barely touches size. An
      // accumulating core has to be seen to swell as it fills, so its
      // radius tracks the level far more strongly.
      radius:
        layout.coreRadius *
        (config.coreGlow.mode === "accumulate"
          ? 0.72 + 0.3 * level
          : 0.97 + 0.03 * level),
      config,
      level,
    });
    ctx.restore();
    bloomPass(ctx, ctx.canvas, {
      width: layout.width,
      height: layout.height,
      radius: 150,
      strength: 0.26 * Math.min(1.6, level),
      downscale: 6,
    });
  });
  return <canvas ref={ref} style={layerStyle("screen")} />;
};
