import React, { useLayoutEffect } from "react";
import { rgba } from "../lib/color";
import type { ActiveLeak } from "../lib/leak";
import { buildLeakEvents, leakOrigin } from "../lib/leak";
import type { LayerBaseProps } from "./types";
import { layerContext } from "./types";
import type { LayerSettings } from "../variants";

/**
 * A broad bloom of light entering from one edge of the frame.
 *
 * The thing that separates a light leak from a plain amber glow is chromatic
 * separation at the leading edge, so the bloom is built from three additive
 * radial gradients rather than one:
 *
 *   - a hot white core near the origin,
 *   - the amber body, which has faded almost to nothing by ~0.8 of its radius,
 *   - a cyan band peaking beyond that and drawn at a slightly larger radius,
 *     so one channel literally reaches further than the others.
 *
 * Where the amber has died and the cyan has not, you get the cold fringe real
 * film shows where a leak meets the unexposed frame.
 */

type LeakGradientStop = { at: number; alpha: number };

const WHITE_STOPS: LeakGradientStop[] = [
  { at: 0, alpha: 0.8 },
  { at: 0.35, alpha: 0.34 },
  { at: 0.7, alpha: 0.07 },
  { at: 1, alpha: 0 },
];

const AMBER_STOPS: LeakGradientStop[] = [
  { at: 0, alpha: 0.62 },
  { at: 0.3, alpha: 0.46 },
  { at: 0.55, alpha: 0.24 },
  { at: 0.75, alpha: 0.07 },
  { at: 0.9, alpha: 0.015 },
  { at: 1, alpha: 0 },
];

const CYAN_STOPS: LeakGradientStop[] = [
  { at: 0, alpha: 0 },
  { at: 0.62, alpha: 0 },
  { at: 0.74, alpha: 0.13 },
  { at: 0.84, alpha: 0.32 },
  { at: 0.93, alpha: 0.12 },
  { at: 1, alpha: 0 },
];

/** Radius multipliers: cyan reaches marginally further than the body. */
const WHITE_RADIUS = 0.42;
const AMBER_RADIUS = 1;
const CYAN_RADIUS = 1.08;

const paintBloom = (
  ctx: CanvasRenderingContext2D,
  leak: ActiveLeak,
  width: number,
  height: number,
  color: string,
  stops: LeakGradientStop[],
  radiusScale: number,
  strength: number,
): void => {
  const origin = leakOrigin(leak.event, width, height);
  const radius = origin.radius * radiusScale;

  ctx.save();
  // Scale about the origin so the bloom is an ellipse elongated along the
  // edge it enters from, not a circle.
  ctx.translate(origin.x, origin.y);
  ctx.scale(origin.scaleX, origin.scaleY);
  const gradient = ctx.createRadialGradient(0, 0, 0, 0, 0, radius);
  for (let i = 0; i < stops.length; i++) {
    gradient.addColorStop(stops[i].at, rgba(color, stops[i].alpha * strength));
  }
  ctx.fillStyle = gradient;
  ctx.beginPath();
  ctx.arc(0, 0, radius, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
};

type LightLeakProps = LayerBaseProps & {
  settings: LayerSettings["leak"];
  loopFrames: number;
  /** Resolved once by <GrungeOverlay> and shared with <FilmGrain>. */
  leaks: ActiveLeak[];
};

export const LightLeak: React.FC<LightLeakProps> = (props) => {
  const { width, height, palette, intensity, leaks } = props;
  const leakPalette = palette.leak;

  useLayoutEffect(() => {
    const ctx = layerContext(props);
    if (!ctx || !leakPalette || leaks.length === 0) return;

    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    for (let i = 0; i < leaks.length; i++) {
      const leak = leaks[i];
      const strength = leak.strength * intensity;
      if (strength > 0.002) {
        paintBloom(ctx, leak, width, height, leakPalette.cyan, CYAN_STOPS, CYAN_RADIUS, strength);
        paintBloom(ctx, leak, width, height, leakPalette.amber, AMBER_STOPS, AMBER_RADIUS, strength);
        paintBloom(ctx, leak, width, height, leakPalette.white, WHITE_STOPS, WHITE_RADIUS, strength);
      }
      // The frame edge burning through: a couple of frames near full
      // brightness across the whole frame.
      if (leak.flash > 0) {
        ctx.fillStyle = rgba(leakPalette.white, 0.62 * leak.flash * intensity);
        ctx.fillRect(0, 0, width, height);
      }
    }
    ctx.restore();
  });

  return null;
};

/** Re-exported so <GrungeOverlay> can build the schedule once. */
export { buildLeakEvents };
