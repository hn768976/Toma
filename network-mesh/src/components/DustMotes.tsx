import React, { useLayoutEffect, useMemo, useRef } from "react";
import { rgba } from "../lib/color";
import { rnd, rndInt, rndRange } from "../lib/rng";
import type { Palette } from "../variants";

const TAU = Math.PI * 2;
const MARGIN = 140;

interface Mote {
  x0: number;
  y0: number;
  radius: number;
  alpha: number;
  /** Whole spans travelled over the loop, so the drift closes exactly. */
  laps: number;
  wobble: number;
  phase: number;
  k: number;
}

const buildMotes = (count: number, width: number, height: number): Mote[] => {
  const span = height + MARGIN * 2;
  const motes: Mote[] = [];
  for (let i = 0; i < count; i++) {
    const s = `mote-${i}`;
    motes.push({
      x0: rndRange(`${s}-x`, -0.02, 1.02) * width,
      y0: rnd(`${s}-y`) * span,
      radius: rndRange(`${s}-r`, 1.4, 4.6),
      alpha: rndRange(`${s}-a`, 0.06, 0.22),
      laps: rndInt(`${s}-l`, 1, 3),
      wobble: rndRange(`${s}-w`, 8, 46),
      phase: rnd(`${s}-p`) * TAU,
      k: rnd(`${s}-k`) < 0.5 ? 1 : 2,
    });
  }
  return motes;
};

export interface DustMotesProps {
  width: number;
  height: number;
  frame: number;
  duration: number;
  palette: Palette;
  /** Current rising-bloom level, 0..1; motes catch its light. */
  bloomLevel: number;
  count?: number;
}

/**
 * Fine motes drifting slowly upward through the frame, brighter low down
 * where the bloom is. Each mote covers a whole number of wrap spans over the
 * loop, so frame 450 puts every one back exactly where it started.
 */
export const DustMotes: React.FC<DustMotesProps> = ({
  width,
  height,
  frame,
  duration,
  palette,
  bloomLevel,
  count = 200,
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const motes = useMemo(
    () => buildMotes(count, width, height),
    [count, width, height],
  );

  useLayoutEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, width, height);
    ctx.globalCompositeOperation = "lighter";

    const span = height + MARGIN * 2;
    const t = (frame / duration) * TAU;
    const color = palette.bloomCore ?? palette.nodePale;

    for (let i = 0; i < motes.length; i++) {
      const m = motes[i];
      const travelled = (m.laps * span * frame) / duration;
      const y = ((m.y0 - travelled) % span + span) % span - MARGIN;
      const x = m.x0 + m.wobble * Math.sin(m.k * t + m.phase);
      // Lower half of frame is where the bloom is, so motes read brightest there.
      const depthLift = 0.3 + 0.7 * Math.max(0, Math.min(1, y / height));
      const alpha = m.alpha * depthLift * (0.45 + 0.75 * bloomLevel);
      if (alpha < 0.004) continue;
      const g = ctx.createRadialGradient(x, y, 0, x, y, m.radius * 3);
      g.addColorStop(0, rgba(color, alpha));
      g.addColorStop(0.4, rgba(color, alpha * 0.45));
      g.addColorStop(1, rgba(color, 0));
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(x, y, m.radius * 3, 0, TAU);
      ctx.fill();
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
