/**
 * The ground the field sits on: a corner-to-corner gradient from the deep
 * tone in the open corner to the saturated hue in the dense corner, with a
 * very faint large-scale mottling over it so the ramp is not perfectly smooth.
 *
 * The mottling is multi-octave value noise computed at 1/8 resolution
 * (480x270) and upscaled by the browser, then blurred, which is both cheaper
 * and softer than generating broad tonal variation at 4K.
 */

import React, { useLayoutEffect, useMemo, useRef } from "react";
import { AbsoluteFill } from "remotion";
import { HEIGHT, LOOP_FRAMES, MOTTLE_DIVISOR, WIDTH } from "./constants";
import { TAU, clamp01, lerp, rand } from "./geometry";
import { Corner, VariantName, VARIANTS } from "./variants";

const MOTTLE_W = WIDTH / MOTTLE_DIVISOR;
const MOTTLE_H = HEIGHT / MOTTLE_DIVISOR;

const cornerPoint = (c: Corner) => ({ x: c.x * WIDTH, y: c.y * HEIGHT });

/** Bilinear value noise on a `cols x rows` grid, sampled at (u, v) in [0, 1]. */
const valueNoise = (
  cols: number,
  rows: number,
  u: number,
  v: number,
  grid: number[],
) => {
  const fx = u * cols;
  const fy = v * rows;
  const x0 = Math.floor(fx);
  const y0 = Math.floor(fy);
  const tx = fx - x0;
  const ty = fy - y0;
  // Smoothstep the interpolant so cell edges do not read as creases.
  const sx = tx * tx * (3 - 2 * tx);
  const sy = ty * ty * (3 - 2 * ty);
  const at = (x: number, y: number) =>
    grid[Math.min(rows, y) * (cols + 1) + Math.min(cols, x)];
  return lerp(
    lerp(at(x0, y0), at(x0 + 1, y0), sx),
    lerp(at(x0, y0 + 1), at(x0 + 1, y0 + 1), sx),
    sy,
  );
};

const buildGrid = (seed: string, cols: number, rows: number) => {
  const grid: number[] = [];
  for (let y = 0; y <= rows; y++) {
    for (let x = 0; x <= cols; x++) {
      grid.push(rand(`${seed}:${x}:${y}`));
    }
  }
  return grid;
};

const OCTAVES = [
  { cols: 6, rows: 4, amp: 1 },
  { cols: 13, rows: 8, amp: 0.5 },
  { cols: 27, rows: 17, amp: 0.25 },
];

export const BackgroundGradient: React.FC<{
  variant: VariantName;
  frame: number;
}> = ({ variant, frame }) => {
  const { palette, densityCorner, copyCorner } = VARIANTS[variant];
  const bgRef = useRef<HTMLCanvasElement>(null);
  const mottleRef = useRef<HTMLCanvasElement>(null);

  const grids = useMemo(
    () => OCTAVES.map((o, i) => buildGrid(`mottle:${variant}:${i}`, o.cols, o.rows)),
    [variant],
  );

  useLayoutEffect(() => {
    const ctx = bgRef.current?.getContext("2d");
    if (!ctx) return;
    const from = cornerPoint(copyCorner);
    const to = cornerPoint(densityCorner);
    const gradient = ctx.createLinearGradient(from.x, from.y, to.x, to.y);
    // Weighted hard towards the deep tone: the saturated hue is meant to be a
    // corner, not half the frame. A linear ramp puts the hot stop far too far
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
    const image = ctx.createImageData(MOTTLE_W, MOTTLE_H);
    const data = image.data;
    let i = 0;
    for (let y = 0; y < MOTTLE_H; y++) {
      const v = y / MOTTLE_H;
      for (let x = 0; x < MOTTLE_W; x++) {
        const u = x / MOTTLE_W;
        let sum = 0;
        let norm = 0;
        for (let o = 0; o < OCTAVES.length; o++) {
          const oct = OCTAVES[o];
          sum += valueNoise(oct.cols, oct.rows, u, v, grids[o]) * oct.amp;
          norm += oct.amp;
        }
        const level = Math.round(clamp01(sum / norm) * 255);
        data[i++] = level;
        data[i++] = level;
        data[i++] = level;
        data[i++] = 255;
      }
    }
    ctx.putImageData(image, 0, 0);
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
        style={{
          position: "absolute",
          inset: 0,
          width: "100%",
          height: "100%",
          display: "block",
          filter: "blur(38px)",
          mixBlendMode: "soft-light",
          opacity: mottleOpacity,
        }}
      />
    </AbsoluteFill>
  );
};
