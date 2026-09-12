import React, { useLayoutEffect, useMemo, useRef } from "react";
import { useCurrentFrame } from "remotion";
import { BASE_HEIGHT, BASE_WIDTH, LOOP } from "../constants";
import { rngFor } from "../random";
import type { HudTheme } from "../theme";
import { buildMapDots, type MapWindow } from "../worldMap";

// Every cycle length below divides LOOP, so each element is back at its
// starting state on the last frame and the clip loops without a seam.
const DOT_CYCLES = [100, 120, 150, 200] as const;
const BLOCK_CYCLES = [60, 75, 100, 120, 150, 200] as const;
const BLOCK_COUNT = 230;

type Block = {
  x: number;
  y: number;
  size: number;
  cycle: number;
  phase: number;
  drift: number;
  bright: boolean;
  peak: number;
};

// The dot-matrix world map and the scatter of "data blocks" over it. This
// is the one layer drawn to a canvas rather than SVG: it is several
// thousand independent quads per frame, which the DOM/SVG path is far too
// slow to re-reconcile 600 times. Sharpness at 4K comes from sizing the
// canvas backing store to the real output resolution and scaling the 2D
// context, so the canvas is still authored in 1920x1080 design units.
export const DataField: React.FC<{
  theme: HudTheme;
  scale: number;
  mapWindow: MapWindow;
  /** how far the whole field parallaxes over one loop, in design units */
  parallax?: number;
  seed?: string;
}> = ({ theme, scale, mapWindow, parallax = 18, seed = "field" }) => {
  const frame = useCurrentFrame();
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const dots = useMemo(
    () => buildMapDots(mapWindow, rngFor(`${seed}:map`)),
    [mapWindow, seed],
  );

  const blocks = useMemo<Block[]>(() => {
    const rand = rngFor(`${seed}:blocks`);
    return Array.from({ length: BLOCK_COUNT }, () => ({
      x: rand() * BASE_WIDTH,
      y: rand() * BASE_HEIGHT,
      size: 7 + rand() * 19,
      cycle: BLOCK_CYCLES[Math.floor(rand() * BLOCK_CYCLES.length)],
      phase: rand(),
      drift: (rand() - 0.5) * 2,
      bright: rand() > 0.62,
      peak: 0.35 + rand() * 0.65,
    }));
  }, [seed]);

  useLayoutEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;

    ctx.setTransform(scale, 0, 0, scale, 0, 0);
    ctx.clearRect(0, 0, BASE_WIDTH, BASE_HEIGHT);

    // Whole-field parallax: one slow orbit per loop.
    const t = (frame / LOOP) * Math.PI * 2;
    const offsetX = Math.cos(t) * parallax;
    const offsetY = Math.sin(t) * parallax * 0.45;

    dots.forEach((dot, i) => {
      const cycle = DOT_CYCLES[i % DOT_CYCLES.length];
      const wave = Math.sin(((frame / cycle) + dot.phase) * Math.PI * 2);
      const alpha = dot.bright * (0.78 + 0.22 * wave);
      ctx.globalAlpha = Math.max(0, Math.min(1, alpha));
      ctx.fillStyle = dot.hot && wave > 0.55 ? theme.mapDotBright : theme.mapDot;
      const s = dot.size;
      ctx.fillRect(dot.x + offsetX - s / 2, dot.y + offsetY - s / 2, s, s);
    });

    for (const block of blocks) {
      // sin(pi * t) gives a clean fade up and back down to exactly 0 at
      // the ends of each cycle, so blocks never pop in or out.
      const t01 = (((frame / block.cycle) + block.phase) % 1 + 1) % 1;
      const alpha = Math.sin(Math.PI * t01) * block.peak;
      if (alpha <= 0.002) continue;
      ctx.globalAlpha = alpha;
      ctx.fillStyle = block.bright ? theme.blockBright : theme.blockDim;
      const dy = block.drift * t01 * 26;
      ctx.fillRect(
        block.x + offsetX * 1.6,
        block.y + offsetY * 1.6 + dy,
        block.size,
        block.size,
      );
    }

    ctx.globalAlpha = 1;
  }, [frame, scale, dots, blocks, theme, parallax]);

  return (
    <canvas
      ref={canvasRef}
      width={Math.round(BASE_WIDTH * scale)}
      height={Math.round(BASE_HEIGHT * scale)}
      style={{ position: "absolute", inset: 0, width: "100%", height: "100%" }}
    />
  );
};
