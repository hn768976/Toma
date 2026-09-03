import React, { useLayoutEffect, useRef } from "react";
import { rgba } from "../lib/color";
import { rnd, rndRange } from "../lib/rng";
import type { Palette } from "../variants";

const TAU = Math.PI * 2;

/** Frames a single traversal spends crossing the frame; the rest is dark. */
const TRAVEL_FRAMES = 180;
/** Two traversals across the 450-frame loop. */
const TRAVERSALS = 2;

export interface FlareState {
  x: number;
  y: number;
  /** 0 while no flare is present, rising to 1 mid-crossing. */
  intensity: number;
}

/**
 * Where the flare is at `frame`. Exported so the mesh can brighten the nodes
 * and edges the flare passes over without duplicating the timing.
 */
export const flareStateAt = (
  frame: number,
  duration: number,
  width: number,
  height: number,
): FlareState => {
  const cycleLength = duration / TRAVERSALS;
  const cycle = Math.floor(frame / cycleLength) % TRAVERSALS;
  const local = frame % cycleLength;
  if (local >= TRAVEL_FRAMES) return { x: 0, y: 0, intensity: 0 };

  const p = local / TRAVEL_FRAMES;
  // Alternate direction and height so the two traversals do not repeat.
  const leftToRight = cycle === 0;
  const from = leftToRight ? -0.38 : 1.38;
  const to = leftToRight ? 1.38 : -0.38;
  const x = (from + (to - from) * p) * width;
  const y = (cycle === 0 ? 0.34 : 0.63) * height;
  const intensity = Math.pow(Math.sin(Math.PI * p), 0.62);
  return { x, y, intensity };
};

export interface AnamorphicFlareProps {
  width: number;
  height: number;
  frame: number;
  duration: number;
  palette: Palette;
}

/**
 * Draws a very wide, very flat elliptical glow. Scaling the context lets one
 * radial gradient serve as an anamorphic streak.
 */
const streak = (
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  halfLength: number,
  halfHeight: number,
  color: string,
  alpha: number,
) => {
  if (alpha <= 0.001) return;
  ctx.save();
  ctx.translate(cx, cy);
  ctx.scale(halfLength, halfHeight);
  const g = ctx.createRadialGradient(0, 0, 0, 0, 0, 1);
  g.addColorStop(0, rgba(color, alpha));
  g.addColorStop(0.22, rgba(color, alpha * 0.6));
  g.addColorStop(0.55, rgba(color, alpha * 0.2));
  g.addColorStop(0.82, rgba(color, alpha * 0.05));
  g.addColorStop(1, rgba(color, 0));
  ctx.fillStyle = g;
  ctx.fillRect(-1, -1, 2, 2);
  ctx.restore();
};

const glow = (
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  radius: number,
  color: string,
  alpha: number,
) => {
  if (alpha <= 0.001) return;
  const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, radius);
  g.addColorStop(0, rgba(color, alpha));
  g.addColorStop(0.35, rgba(color, alpha * 0.35));
  g.addColorStop(1, rgba(color, 0));
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(cx, cy, radius, 0, TAU);
  ctx.fill();
};

const hexagon = (
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  radius: number,
  rotation: number,
  color: string,
  alpha: number,
) => {
  ctx.fillStyle = rgba(color, alpha);
  ctx.beginPath();
  for (let i = 0; i < 6; i++) {
    const a = rotation + (i / 6) * TAU;
    const px = cx + Math.cos(a) * radius;
    const py = cy + Math.sin(a) * radius;
    if (i === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  }
  ctx.closePath();
  ctx.fill();
};

// Where the secondary artefacts sit along the axis running from the flare
// core through the frame's centre, as a real lens produces them.
const GHOSTS = [-0.42, -0.18, 0.3, 0.52, 0.78, 1.12, 1.4] as const;

/**
 * A travelling anamorphic lens flare: a hot white core inside a wide flat
 * streak, with cyan and magenta copies offset either side. The chromatic
 * fringe is what makes it read as a lens artefact rather than a drawn line.
 */
export const AnamorphicFlare: React.FC<AnamorphicFlareProps> = ({
  width,
  height,
  frame,
  duration,
  palette,
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useLayoutEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.globalCompositeOperation = "source-over";
    ctx.clearRect(0, 0, width, height);

    const core = palette.flareCore;
    const cyan = palette.flareCyan;
    const magenta = palette.flareMagenta;
    if (!core || !cyan || !magenta) return;

    const { x, y, intensity } = flareStateAt(frame, duration, width, height);
    if (intensity <= 0.002) return;

    ctx.globalCompositeOperation = "lighter";

    // Chromatic fringe: the streak drawn three times, the tinted copies
    // pushed apart horizontally and spread a little taller than the core.
    const fringe = width * 0.038;
    streak(ctx, x - fringe, y, width * 2.4, 58, cyan, 0.5 * intensity);
    streak(ctx, x + fringe, y, width * 2.4, 58, magenta, 0.44 * intensity);
    streak(ctx, x - fringe * 0.45, y, width * 1.7, 26, cyan, 0.4 * intensity);
    streak(ctx, x + fringe * 0.45, y, width * 1.7, 26, magenta, 0.36 * intensity);

    // The white core sits on top and stays narrow.
    streak(ctx, x, y, width * 2.1, 17, core, 0.92 * intensity);
    streak(ctx, x, y, width * 0.85, 7, core, 1 * intensity);

    // Soft radial bloom around the core.
    glow(ctx, x, y, 480, core, 0.42 * intensity);
    glow(ctx, x, y, 1150, cyan, 0.1 * intensity);
    glow(ctx, x, y, 820, magenta, 0.06 * intensity);

    // Secondary elements along the core -> frame-centre axis.
    const vx = width / 2 - x;
    const vy = height / 2 - y;
    for (let i = 0; i < GHOSTS.length; i++) {
      const t = GHOSTS[i];
      const gx = x + vx * 2 * t;
      const gy = y + vy * 2 * t;
      const s = `ghost-${i}`;
      const radius = rndRange(`${s}-r`, 34, 150);
      const alpha =
        rndRange(`${s}-a`, 0.05, 0.16) * intensity;
      const tint = i % 3 === 0 ? cyan : i % 3 === 1 ? magenta : core;
      if (rnd(`${s}-shape`) < 0.45) {
        hexagon(ctx, gx, gy, radius, rnd(`${s}-rot`) * TAU, tint, alpha * 0.7);
      } else {
        glow(ctx, gx, gy, radius, tint, alpha);
        ctx.strokeStyle = rgba(tint, alpha * 0.8);
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(gx, gy, radius * 0.86, 0, TAU);
        ctx.stroke();
      }
    }

    ctx.globalCompositeOperation = "source-over";
  });

  return (
    <canvas
      ref={canvasRef}
      width={width}
      height={height}
      style={{
        position: "absolute",
        inset: 0,
        width: "100%",
        height: "100%",
        mixBlendMode: "screen",
      }}
    />
  );
};
