import React, { useLayoutEffect, useMemo, useRef } from "react";
import { createBuffer } from "../vendor/core/canvas";
import { rgba } from "../vendor/core/color";
import type { Palette } from "../variants";

const TAU = Math.PI * 2;
/** Two full breaths across the 450-frame loop. */
const CYCLES = 2;
const SCALE = 0.125;

/**
 * How far the bloom has risen at `frame`: 0 fully receded, 1 filling the
 * lower third. Exported so the mesh can brighten nodes the bloom rises past.
 */
export const bloomLevelAt = (frame: number, duration: number): number => {
  const cycleLength = duration / CYCLES;
  return 0.5 - 0.5 * Math.cos((TAU * (frame % cycleLength)) / cycleLength);
};

/** The y above which the bloom has no effect on the mesh. */
export const bloomTopAt = (
  frame: number,
  duration: number,
  height: number,
): number => height - bloomLevelAt(frame, duration) * height * 0.6;

export interface LightBloomProps {
  width: number;
  height: number;
  frame: number;
  duration: number;
  palette: Palette;
}

/**
 * A broad, heavily blurred glow rising from below the lower edge and
 * receding again. No hard core, no streak, no chromatic fringe — this is
 * atmospheric light, not a lens artefact.
 */
export const LightBloom: React.FC<LightBloomProps> = ({
  width,
  height,
  frame,
  duration,
  palette,
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const buffer = useMemo(
    () => createBuffer(width * SCALE, height * SCALE),
    [width, height],
  );

  useLayoutEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !buffer) return;
    const out = canvas.getContext("2d");
    const ctx = buffer.getContext("2d");
    if (!out || !ctx) return;

    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, buffer.width, buffer.height);
    ctx.setTransform(SCALE, 0, 0, SCALE, 0, 0);
    out.setTransform(1, 0, 0, 1, 0, 0);
    out.clearRect(0, 0, width, height);

    const core = palette.bloomCore;
    const tint = palette.bloomTint;
    if (!core || !tint) return;

    const level = bloomLevelAt(frame, duration);
    if (level <= 0.002) return;

    ctx.globalCompositeOperation = "lighter";

    // A very wide, very flat ellipse sunk below the bottom edge, growing up
    // into the frame as the bloom rises.
    const cx = width * 0.5;
    const cy = height * (1.1 - 0.14 * level);
    const rx = width * (0.66 + 0.22 * level);
    const ry = height * (0.34 + 0.4 * level);
    ctx.save();
    ctx.translate(cx, cy);
    ctx.scale(rx, ry);
    const g = ctx.createRadialGradient(0, 0, 0, 0, 0, 1);
    g.addColorStop(0, rgba(core, 0.38 * level));
    g.addColorStop(0.3, rgba(tint, 0.24 * level));
    g.addColorStop(0.62, rgba(tint, 0.12 * level));
    g.addColorStop(0.85, rgba(tint, 0.035 * level));
    g.addColorStop(1, rgba(tint, 0));
    ctx.fillStyle = g;
    ctx.fillRect(-1, -1, 2, 2);
    ctx.restore();

    // A second, off-centre lobe keeps the glow from looking like a symmetric
    // gradient wipe.
    const lx = width * (0.32 + 0.1 * level);
    const ly = height * (1.16 - 0.1 * level);
    ctx.save();
    ctx.translate(lx, ly);
    ctx.scale(width * 0.4, height * (0.26 + 0.3 * level));
    const g2 = ctx.createRadialGradient(0, 0, 0, 0, 0, 1);
    g2.addColorStop(0, rgba(tint, 0.2 * level));
    g2.addColorStop(0.5, rgba(tint, 0.1 * level));
    g2.addColorStop(1, rgba(tint, 0));
    ctx.fillStyle = g2;
    ctx.fillRect(-1, -1, 2, 2);
    ctx.restore();

    out.filter = "blur(46px)";
    out.drawImage(buffer, 0, 0, width, height);
    out.filter = "none";
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
