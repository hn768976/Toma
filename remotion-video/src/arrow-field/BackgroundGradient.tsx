/**
 * The ground the field sits on: a corner-to-corner gradient from the deep
 * tone in the open corner to the saturated hue in the dense corner, with a
 * very faint large-scale mottling over it so the ramp is not perfectly smooth.
 *
 * The mottling is multi-octave value noise computed at 1/8 resolution
 * (480x270) and upscaled by the browser, then blurred — both cheaper and
 * softer than generating broad tonal variation at 4K.
 */

import React, { useLayoutEffect, useMemo, useRef } from "react";
import { AbsoluteFill } from "remotion";
import {
  HEIGHT,
  LOOP_FRAMES,
  MOTTLE_H,
  MOTTLE_W,
  WIDTH,
} from "./constants";
import { TAU } from "../lib/random";
import {
  MOTTLE_OCTAVES,
  buildNoiseGrid,
  lowResLayerStyle,
  paintNoiseField,
} from "../lib/passes/lowResUpscale";
import { Corner, VariantName, VARIANTS } from "./variants";

const cornerPoint = (c: Corner) => ({ x: c.x * WIDTH, y: c.y * HEIGHT });

export const BackgroundGradient: React.FC<{
  variant: VariantName;
  frame: number;
}> = ({ variant, frame }) => {
  const { palette, densityCorner, copyCorner } = VARIANTS[variant];
  const bgRef = useRef<HTMLCanvasElement>(null);
  const mottleRef = useRef<HTMLCanvasElement>(null);

  const grids = useMemo(
    () =>
      MOTTLE_OCTAVES.map((o, i) =>
        buildNoiseGrid(`mottle:${variant}:${i}`, o.cols, o.rows),
      ),
    [variant],
  );

  useLayoutEffect(() => {
    const ctx = bgRef.current?.getContext("2d");
    if (!ctx) return;
    const from = cornerPoint(copyCorner);
    const to = cornerPoint(densityCorner);
    const gradient = ctx.createLinearGradient(from.x, from.y, to.x, to.y);
    // Weighted hard towards the deep tone: the saturated hue is meant to be a
    // corner, not half the frame. An even ramp puts the hot stop far too far
    // across the diagonal and leaves nothing dark enough to carry copy.
    gradient.addColorStop(0, palette.bgDeep);
    gradient.addColorStop(0.45, palette.bgDeep);
    gradient.addColorStop(0.8, palette.bgMid);
    gradient.addColorStop(1, palette.bgHot);
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, WIDTH, HEIGHT);
  });

  useLayoutEffect(() => {
    const ctx = mottleRef.current?.getContext("2d");
    if (!ctx) return;
    paintNoiseField(ctx, MOTTLE_W, MOTTLE_H, MOTTLE_OCTAVES, grids);
  }, [grids]);

  const t = (frame % LOOP_FRAMES) / LOOP_FRAMES;
  // A slow breathe so the mottling is not dead-static across the loop.
  const mottleOpacity = 0.5 + 0.08 * Math.sin(TAU * t);

  return (
    <AbsoluteFill>
      <canvas
        ref={bgRef}
        width={WIDTH}
        height={HEIGHT}
        style={{ width: "100%", height: "100%", display: "block" }}
      />
      <canvas
        ref={mottleRef}
        width={MOTTLE_W}
        height={MOTTLE_H}
        style={lowResLayerStyle({ blur: 38, opacity: mottleOpacity })}
      />
    </AbsoluteFill>
  );
};
