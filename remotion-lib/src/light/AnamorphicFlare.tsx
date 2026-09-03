import React, { useLayoutEffect, useRef } from "react";
import { rgba } from "../core/color";
import { rnd, rndRange } from "../core/seeded-random";

const TAU = Math.PI * 2;

const DEFAULT_TRAVEL_FRAMES = 180;
const DEFAULT_TRAVERSALS = 2;
/** Height of each traversal as a fraction of frame height. */
const DEFAULT_HEIGHTS = [0.34, 0.63];

/** Timing and path of the travelling flare. Defaults suit a 450-frame loop. */
export interface FlareTravel {
  /**
   * Frames one traversal spends crossing the frame. The remainder of each
   * cycle (duration / traversals) has no flare at all.
   */
  travelFrames?: number;
  /** Crossings per loop. `duration` must divide evenly by this. */
  traversals?: number;
  /** Height of each traversal, 0..1 of frame height. Cycles if shorter. */
  heights?: readonly number[];
  /** Whether traversal 0 runs left to right; each one alternates from there. */
  startLeftToRight?: boolean;
  /** How far past each edge the flare starts and ends, in frame widths. */
  overshoot?: number;
}

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
  travel: FlareTravel = {},
): FlareState => {
  const travelFrames = travel.travelFrames ?? DEFAULT_TRAVEL_FRAMES;
  const traversals = travel.traversals ?? DEFAULT_TRAVERSALS;
  const heights = travel.heights ?? DEFAULT_HEIGHTS;
  const startLeftToRight = travel.startLeftToRight ?? true;
  const overshoot = travel.overshoot ?? 0.38;

  const cycleLength = duration / traversals;
  const cycle = Math.floor(frame / cycleLength) % traversals;
  const local = frame % cycleLength;
  if (local >= travelFrames) return { x: 0, y: 0, intensity: 0 };

  const p = local / travelFrames;
  // Alternate direction and height so successive traversals do not repeat.
  const leftToRight = cycle % 2 === 0 ? startLeftToRight : !startLeftToRight;
  const from = leftToRight ? -overshoot : 1 + overshoot;
  const to = leftToRight ? 1 + overshoot : -overshoot;
  const x = (from + (to - from) * p) * width;
  const y = heights[cycle % heights.length] * height;
  // Fades from and to nothing, so a cycle boundary is never a cut.
  const intensity = Math.pow(Math.sin(Math.PI * p), 0.62);
  return { x, y, intensity };
};

/** The three colours the streak is composited from. */
export interface AnamorphicFlareColors {
  /** The hot core. Usually white. */
  core: string;
  /** Fringe tint offset one way; conventionally cyan. */
  fringeA: string;
  /** Fringe tint offset the other way; conventionally magenta. */
  fringeB: string;
}

export interface AnamorphicFlareProps {
  width: number;
  height: number;
  frame: number;
  duration: number;
  colors: AnamorphicFlareColors;
  travel?: FlareTravel;
  /** Overall opacity of the whole flare. */
  intensityScale?: number;
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
 * <AnamorphicFlare> — a travelling anamorphic lens flare: a hot white core inside a wide flat
 * streak, with cyan and magenta copies offset either side. The chromatic
 * fringe is what makes it read as a lens artefact rather than a drawn line.
 */
export const AnamorphicFlare: React.FC<AnamorphicFlareProps> = ({
  width,
  height,
  frame,
  duration,
  colors,
  travel,
  intensityScale = 1,
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

    const { core, fringeA: cyan, fringeB: magenta } = colors;

    const state = flareStateAt(frame, duration, width, height, travel);
    const { x, y } = state;
    const intensity = state.intensity * intensityScale;
    if (intensity <= 0.002) return;

    ctx.globalCompositeOperation = "lighter";

    // Chromatic fringe. Three things make it read as a lens artefact rather
    // than a drawn line: the tinted copies are pushed far enough apart
    // horizontally that their tails extend past the white core, they are
    // offset vertically so one colour rides above the line and the other
    // below, and the core itself is kept short and thin so it cannot wash
    // them out.
    const fringeX = width * 0.17;
    const fringeY = 16;
    streak(ctx, x - fringeX, y - fringeY, width * 2.35, 62, cyan, 0.6 * intensity);
    streak(ctx, x + fringeX, y + fringeY, width * 2.35, 62, magenta, 0.55 * intensity);
    streak(ctx, x - fringeX * 0.32, y - fringeY * 0.45, width * 1.75, 26, cyan, 0.45 * intensity);
    streak(ctx, x + fringeX * 0.32, y + fringeY * 0.45, width * 1.75, 26, magenta, 0.42 * intensity);

    // The hot white core: shorter than the tinted tails, so the ends of the
    // streak stay cyan one way and magenta the other.
    streak(ctx, x, y, width * 1.45, 10, core, 0.82 * intensity);
    streak(ctx, x, y, width * 0.45, 4.5, core, 1 * intensity);

    // Soft radial bloom around the core.
    glow(ctx, x, y, 460, core, 0.3 * intensity);
    glow(ctx, x, y, 1180, cyan, 0.14 * intensity);
    glow(ctx, x, y, 900, magenta, 0.11 * intensity);

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
